import { supabase, addPhotoRecord, deletePhotoRecord, getPhotos, updateDatasetPhotoCount, getPhotoPublicUrl, getUnsyncedPhotos, updatePhotosToSynced, PhotoHf } from './supabase';
import { HF_TOKEN, HF_REPO, SUPABASE_BUCKET } from './config';

const lastGeneratedIndexMap = new Map<string, number>();

/**
 * Calculates next filename and sequence index for photos
 */
export async function getNextFileName(datasetId: string, datasetSlug: string): Promise<{ fileName: string; nextIndex: number | null }> {
  try {
    let nextIndex: number;

    if (lastGeneratedIndexMap.has(datasetId)) {
      nextIndex = (lastGeneratedIndexMap.get(datasetId) || 0) + 1;
    } else {
      const photos = await getPhotos(datasetId);
      let maxIndex = 0;

      if (photos && photos.length > 0) {
        const regex = new RegExp(`${datasetSlug}_(?:[a-z0-9]+_)?(\\d+)\\.jpg$`, 'i');

        photos.forEach(photo => {
          const match = photo.file_name.match(regex);
          if (match) {
            const index = parseInt(match[1], 10);
            if (index > maxIndex) {
              maxIndex = index;
            }
          }
        });
      }
      nextIndex = maxIndex + 1;
    }

    lastGeneratedIndexMap.set(datasetId, nextIndex);

    const randomStr = Math.random().toString(36).substring(2, 7);
    const paddedIndex = String(nextIndex).padStart(3, '0');

    return {
      fileName: `${datasetSlug}_${randomStr}_${paddedIndex}.jpg`,
      nextIndex
    };
  } catch (error) {
    console.error('Gagal mendapatkan nomor urut file berikutnya:', error);
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    return {
      fileName: `${datasetSlug}_err_${Date.now()}_${randomSuffix}.jpg`,
      nextIndex: null
    };
  }
}

/**
 * Uploads a processed photo blob and thumbnail to Supabase Storage and inserts the metadata to PostgreSQL
 */
export async function uploadSinglePhoto(params: {
  datasetId: string;
  datasetSlug: string;
  processedBlob: Blob;
  thumbnail: Blob | null;
  width: number;
  height: number;
  fileName?: string;
}): Promise<PhotoHf & { publicUrl: string; thumbnailUrl: string }> {
  const { datasetId, datasetSlug, processedBlob, thumbnail, width, height } = params;
  let finalFileName = params.fileName;
  if (!finalFileName) {
    const fileInfo = await getNextFileName(datasetId, datasetSlug);
    finalFileName = fileInfo.fileName;
  }

  const storagePath = `${datasetSlug}/${finalFileName}`;
  const thumbnailPath = `${datasetSlug}/thumbnails/${finalFileName}`;

  // 1. Upload main image to Supabase Storage
  const { error: storageError } = await supabase.storage
    .from(SUPABASE_BUCKET)
    .upload(storagePath, processedBlob, {
      contentType: 'image/jpeg',
      upsert: true
    });

  if (storageError) throw storageError;

  // 2. Upload thumbnail to Supabase Storage
  if (thumbnail) {
    try {
      await supabase.storage
        .from(SUPABASE_BUCKET)
        .upload(thumbnailPath, thumbnail, {
          contentType: 'image/jpeg',
          upsert: true
        });
    } catch (thumbErr) {
      console.warn('Gagal upload thumbnail ke Supabase, melanjutkan.', thumbErr);
    }
  }

  // 3. Save metadata to PostgreSQL
  try {
    const dbRecord = await addPhotoRecord({
      datasetId,
      fileName: finalFileName,
      storagePath,
      fileSize: processedBlob.size,
      width,
      height,
      storageProvider: 'supabase'
    });

    const photos = await getPhotos(datasetId);
    await updateDatasetPhotoCount(datasetId, photos.length);

    const publicUrl = getPhotoPublicUrl(dbRecord);
    const thumbnailUrl = getPhotoPublicUrl({ ...dbRecord, storage_path: thumbnailPath });

    return {
      ...dbRecord,
      publicUrl,
      thumbnailUrl
    };
  } catch (dbError) {
    // Rollback storage if db insert fails
    try {
      await supabase.storage.from(SUPABASE_BUCKET).remove([storagePath, thumbnailPath]);
    } catch (rollbackErr) {
      console.error('Gagal rollback file buffer Supabase:', rollbackErr);
    }
    throw dbError;
  }
}

/**
 * Deletes a photo from Storage (Supabase/HF) and metadata from PostgreSQL
 */
export async function deletePhoto(photoId: string, storagePath: string): Promise<boolean> {
  let datasetId: string | null = null;
  let storageProvider = 'supabase';
  try {
    const { data } = await supabase
      .from('photos_hf')
      .select('dataset_id, storage_provider')
      .eq('id', photoId)
      .single();
    if (data) {
      datasetId = data.dataset_id;
      storageProvider = data.storage_provider || 'supabase';
    }
  } catch (e) {
    console.warn('Gagal mendapatkan record foto untuk deletePhoto.', e);
  }

  await deletePhotoRecord(photoId);

  const thumbnailPath = storagePath.replace(/([^/]+)$/, 'thumbnails/$1');

  if (storageProvider === 'huggingface' && HF_REPO) {
    const { deleteFile } = await import('@huggingface/hub');
    try {
      await deleteFile({
        repo: HF_REPO,
        credentials: { accessToken: HF_TOKEN },
        path: storagePath
      });
      await deleteFile({
        repo: HF_REPO,
        credentials: { accessToken: HF_TOKEN },
        path: thumbnailPath
      });
    } catch (e) {
      console.error(`Gagal menghapus file dari Hugging Face: ${storagePath}`, e);
    }
  } else {
    const { error: storageError } = await supabase.storage
      .from(SUPABASE_BUCKET)
      .remove([storagePath, thumbnailPath]);

    if (storageError) {
      console.error(`Gagal menghapus file storage Supabase: ${storagePath}`, storageError);
    }
  }

  if (datasetId) {
    try {
      const photos = await getPhotos(datasetId);
      await updateDatasetPhotoCount(datasetId, photos.length);
    } catch (e) {
      console.warn('Gagal sinkronisasi photo_count setelah hapus foto.', e);
    }
  }

  return true;
}

/**
 * Synchronizes all Supabase-buffered photos of a dataset to Hugging Face
 */
export async function syncDatasetToHF(
  datasetId: string,
  datasetSlug: string,
  onProgress?: (current: number, total: number, statusText: string) => void
): Promise<{ syncedCount: number }> {
  if (!HF_REPO) {
    throw new Error('Konfigurasi Hugging Face (NEXT_PUBLIC_HF_REPO) tidak ditemukan.');
  }

  const unsyncedPhotos = await getUnsyncedPhotos(datasetId);
  if (!unsyncedPhotos || unsyncedPhotos.length === 0) {
    return { syncedCount: 0 };
  }

  const filesToCommit: { path: string; content: Blob }[] = [];
  const dbUpdates: Partial<PhotoHf>[] = [];
  const supabasePathsToDelete: string[] = [];
  const total = unsyncedPhotos.length;

  for (let i = 0; i < total; i++) {
    const photo = unsyncedPhotos[i];
    if (onProgress) {
      onProgress(i, total, `Mengunduh berkas buffer Supabase: ${photo.file_name} (${i + 1}/${total})`);
    }

    try {
      const { data: mainBlob, error: mainErr } = await supabase.storage
        .from(SUPABASE_BUCKET)
        .download(photo.storage_path);

      if (mainErr) throw mainErr;

      const thumbPath = photo.storage_path.replace(/([^/]+)$/, 'thumbnails/$1');
      const { data: thumbBlob } = await supabase.storage
        .from(SUPABASE_BUCKET)
        .download(thumbPath);

      const targetPath = `data/${datasetSlug}/${photo.file_name}`;
      const targetThumbPath = `data/${datasetSlug}/thumbnails/${photo.file_name}`;

      filesToCommit.push({
        path: targetPath,
        content: mainBlob
      });

      if (thumbBlob) {
        filesToCommit.push({
          path: targetThumbPath,
          content: thumbBlob
        });
      }

      dbUpdates.push({
        ...photo,
        storage_provider: 'huggingface',
        storage_path: targetPath
      });

      supabasePathsToDelete.push(photo.storage_path, thumbPath);
    } catch (err) {
      console.error(`Gagal memproses file ${photo.file_name} untuk sinkronisasi:`, err);
    }
  }

  if (filesToCommit.length === 0) {
    throw new Error('Tidak ada file buffer yang berhasil diunduh untuk disinkronkan.');
  }

  if (onProgress) {
    onProgress(total, total, `Mengirimkan komit batch ke Hugging Face...`);
  }

  const { uploadFiles } = await import('@huggingface/hub');
  await uploadFiles({
    repo: HF_REPO,
    credentials: { accessToken: HF_TOKEN },
    files: filesToCommit,
    commitTitle: `Sinkronisasi batch dataset ${datasetSlug} (${dbUpdates.length} foto)`
  });

  if (onProgress) {
    onProgress(total, total, `Memperbarui status database...`);
  }
  await updatePhotosToSynced(dbUpdates);

  const batchSize = 100;
  for (let i = 0; i < supabasePathsToDelete.length; i += batchSize) {
    const batch = supabasePathsToDelete.slice(i, i + batchSize);
    if (onProgress) {
      onProgress(total, total, `Membersihkan file buffer Supabase (${Math.min(i + batch.length, supabasePathsToDelete.length)}/${supabasePathsToDelete.length})...`);
    }
    try {
      const { error: cleanErr } = await supabase.storage
        .from(SUPABASE_BUCKET)
        .remove(batch);
      if (cleanErr) {
        console.warn(`Gagal membersihkan batch file buffer (${i} - ${i + batch.length}):`, cleanErr);
      }
    } catch (err) {
      console.warn(`Gagal membersihkan batch file buffer (${i} - ${i + batch.length}):`, err);
    }
  }

  return { syncedCount: dbUpdates.length };
}

/**
 * Deletes multiple photos from Storage and database in a single batch query
 */
export async function deletePhotosBulk(photosToDelete: PhotoHf[]): Promise<boolean> {
  if (!photosToDelete || photosToDelete.length === 0) return true;

  const photoIds = photosToDelete.map(p => p.id);
  const datasetId = photosToDelete[0].dataset_id;

  // 1. Delete database records in one single query
  const { error: dbError } = await supabase
    .from('photos_hf')
    .delete()
    .in('id', photoIds);

  if (dbError) {
    console.error('Gagal menghapus record database foto secara bulk:', dbError);
    throw dbError;
  }

  // 2. Separate by storage provider
  const sbPhotos = photosToDelete.filter(p => p.storage_provider === 'supabase' || !p.storage_provider);
  const hfPhotos = photosToDelete.filter(p => p.storage_provider === 'huggingface');

  // Delete from Supabase Storage in bulk
  if (sbPhotos.length > 0) {
    const sbPaths: string[] = [];
    sbPhotos.forEach(photo => {
      const thumbPath = photo.storage_path.replace(/([^/]+)$/, 'thumbnails/$1');
      sbPaths.push(photo.storage_path, thumbPath);
    });

    const batchSize = 100;
    for (let i = 0; i < sbPaths.length; i += batchSize) {
      const batch = sbPaths.slice(i, i + batchSize);
      try {
        const { error: storageError } = await supabase.storage
          .from(SUPABASE_BUCKET)
          .remove(batch);

        if (storageError) {
          console.error(`Gagal menghapus batch file bulk dari Supabase Storage (${i} - ${i + batch.length}):`, storageError);
        }
      } catch (e) {
        console.error(`Terjadi kesalahan saat menghapus batch file bulk dari Supabase Storage (${i} - ${i + batch.length}):`, e);
      }
    }
  }

  // Delete from Hugging Face in a single commit commit
  if (hfPhotos.length > 0 && HF_REPO) {
    try {
      const { commit } = await import('@huggingface/hub');
      const operations: any[] = [];

      hfPhotos.forEach(photo => {
        const thumbPath = photo.storage_path.replace(/([^/]+)$/, 'thumbnails/$1');
        operations.push({
          key: 'delete',
          path: photo.storage_path
        });
        operations.push({
          key: 'delete',
          path: thumbPath
        });
      });

      await commit({
        repo: HF_REPO,
        credentials: { accessToken: HF_TOKEN },
        title: `Hapus bulk ${hfPhotos.length} foto dari dashboard`,
        operations
      });
    } catch (e) {
      console.error('Gagal melakukan bulk commit delete ke Hugging Face:', e);
    }
  }

  // 3. Update dataset photo count in database
  if (datasetId) {
    try {
      const remaining = await getPhotos(datasetId);
      await updateDatasetPhotoCount(datasetId, remaining.length);
    } catch (e) {
      console.warn('Gagal memperbarui photo count dataset setelah bulk delete:', e);
    }
  }

  return true;
}
