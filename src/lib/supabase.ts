import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, HF_TOKEN, HF_REPO_ID, HF_REPO, SUPABASE_BUCKET } from './config';

// Initialize Supabase Client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export interface DatasetHf {
  id: string;
  name: string;
  slug: string;
  photo_count: number;
  created_at: string;
  updated_at: string;
}

export interface PhotoHf {
  id: string;
  dataset_id: string;
  file_name: string;
  storage_path: string;
  file_size: number;
  width: number;
  height: number;
  storage_provider: 'supabase' | 'huggingface';
  created_at: string;
}

export interface SyncStats {
  dbCount: number;
  storageCount: number;
  thumbnailCount: number;
  missingInStorage: PhotoHf[];
  orphansInStorage: { path: string; provider: string }[];
  orphansInThumbnails: { path: string; provider: string }[];
  duplicateDbRecords: PhotoHf[];
  isSynced: boolean;
}

/**
 * Resolves the public URL for a photo dynamically (from Supabase or Hugging Face)
 */
export function getPhotoPublicUrl(photo: PhotoHf): string {
  if (!photo) return '';
  
  const provider = photo.storage_provider || 'supabase';
  
  if (provider === 'huggingface' && HF_REPO) {
    const hfBaseUrl = `https://huggingface.co/datasets/${HF_REPO_ID}/resolve/main/`;
    const tokenQuery = HF_TOKEN ? `?token=${HF_TOKEN}` : '';
    return `${hfBaseUrl}${photo.storage_path}${tokenQuery}`;
  }
  
  const { data } = supabase.storage
    .from(SUPABASE_BUCKET)
    .getPublicUrl(photo.storage_path);
  return data?.publicUrl || '';
}

/**
 * Fetch all datasets from Supabase
 */
export async function getDatasets(): Promise<DatasetHf[]> {
  const { data, error } = await supabase
    .from('datasets_hf')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Create a new dataset
 */
export async function createDataset(name: string): Promise<DatasetHf> {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const { data, error } = await supabase
    .from('datasets_hf')
    .insert([{ name, slug }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update dataset name & slug
 */
export async function updateDataset(id: string, name: string): Promise<DatasetHf> {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const { data, error } = await supabase
    .from('datasets_hf')
    .update({ name, slug, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete a dataset
 */
export async function deleteDataset(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('datasets_hf')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return true;
}

/**
 * Get all photos belonging to a dataset
 */
export async function getPhotos(datasetId: string): Promise<PhotoHf[]> {
  const { data, error } = await supabase
    .from('photos_hf')
    .select('*')
    .eq('dataset_id', datasetId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Get the latest photo in a dataset (for thumbnail)
 */
export async function getLatestPhoto(datasetId: string): Promise<PhotoHf | null> {
  const { data, error } = await supabase
    .from('photos_hf')
    .select('*')
    .eq('dataset_id', datasetId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) throw error;
  return data && data.length > 0 ? data[0] : null;
}

/**
 * Add a new photo metadata record to Supabase
 */
export async function addPhotoRecord(params: {
  datasetId: string;
  fileName: string;
  storagePath: string;
  fileSize: number;
  width: number;
  height: number;
  storageProvider?: 'supabase' | 'huggingface';
}): Promise<PhotoHf> {
  const { data, error } = await supabase
    .from('photos_hf')
    .insert([
      {
        dataset_id: params.datasetId,
        file_name: params.fileName,
        storage_path: params.storagePath,
        file_size: params.fileSize,
        width: params.width,
        height: params.height,
        storage_provider: params.storageProvider || 'supabase'
      }
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete a photo metadata record from database
 */
export async function deletePhotoRecord(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('photos_hf')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return true;
}

/**
 * Manually update the dataset's photo count
 */
export async function updateDatasetPhotoCount(datasetId: string, count: number): Promise<DatasetHf> {
  const { data, error } = await supabase
    .from('datasets_hf')
    .update({ photo_count: count, updated_at: new Date().toISOString() })
    .eq('id', datasetId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Checks synchronization status of database vs Supabase / Hugging Face storage
 */
export async function checkDatasetSync(datasetId: string, datasetSlug: string): Promise<SyncStats> {
  const dbPhotos = await getPhotos(datasetId);
  const dbNames = new Set(dbPhotos.map(p => p.file_name));
  
  const mainFiles: { name: string; provider: 'supabase' | 'huggingface'; path: string }[] = [];
  const thumbFiles: { name: string; provider: 'supabase' | 'huggingface'; path: string }[] = [];

  // 1. Fetch files from Supabase Storage
  try {
    const { data: storageFiles, error: storageErr } = await supabase.storage
      .from(SUPABASE_BUCKET)
      .list(datasetSlug, { limit: 1000 });
      
    if (!storageErr && storageFiles) {
      storageFiles.forEach(f => {
        if (f.metadata && f.name !== 'thumbnails') {
          mainFiles.push({
            name: f.name,
            provider: 'supabase',
            path: `${datasetSlug}/${f.name}`
          });
        }
      });
    }

    const { data: thumbnailFiles, error: thumbErr } = await supabase.storage
      .from(SUPABASE_BUCKET)
      .list(`${datasetSlug}/thumbnails`, { limit: 1000 });
      
    if (!thumbErr && thumbnailFiles) {
      thumbnailFiles.forEach(f => {
        if (f.metadata) {
          thumbFiles.push({
            name: f.name,
            provider: 'supabase',
            path: `${datasetSlug}/thumbnails/${f.name}`
          });
        }
      });
    }
  } catch (e) {
    console.warn('Gagal membaca daftar file dari Supabase Storage:', e);
  }

  // 2. Fetch files from Hugging Face
  if (HF_REPO) {
    try {
      const { listFiles } = await import('@huggingface/hub');
      const folderPath = `data/${datasetSlug}`;
      for await (const file of listFiles({
        repo: HF_REPO,
        credentials: { accessToken: HF_TOKEN },
        recursive: true
      })) {
        if (file.path.startsWith(`${folderPath}/`)) {
          const fileName = file.path.split('/').pop() || '';
          if (file.type === 'file' || file.type === undefined) {
            if (file.path.includes('/thumbnails/')) {
              thumbFiles.push({
                name: fileName,
                provider: 'huggingface',
                path: file.path
              });
            } else if (!file.path.endsWith('/')) {
              mainFiles.push({
                name: fileName,
                provider: 'huggingface',
                path: file.path
              });
            }
          }
        }
      }
    } catch (e) {
      console.warn('Gagal membaca daftar file dari Hugging Face:', e);
    }
  }

  // 3. Compute differences
  const mainFileNames = new Set(mainFiles.map(f => f.name));
  const missingInStorage = dbPhotos.filter(p => !mainFileNames.has(p.file_name));
  
  const orphansInStorage = mainFiles
    .filter(f => !dbNames.has(f.name))
    .map(f => ({ path: f.path, provider: f.provider }));
  
  const orphansInThumbnails = thumbFiles
    .filter(f => !dbNames.has(f.name))
    .map(f => ({ path: f.path, provider: f.provider }));

  // Find duplicates
  const nameGroups: Record<string, PhotoHf[]> = {};
  const duplicateDbRecords: PhotoHf[] = [];
  
  dbPhotos.forEach(p => {
    if (!nameGroups[p.file_name]) {
      nameGroups[p.file_name] = [];
    }
    nameGroups[p.file_name].push(p);
  });
  
  Object.keys(nameGroups).forEach(name => {
    const group = nameGroups[name];
    if (group.length > 1) {
      for (let i = 1; i < group.length; i++) {
        duplicateDbRecords.push(group[i]);
      }
    }
  });

  return {
    dbCount: dbPhotos.length,
    storageCount: mainFiles.length,
    thumbnailCount: thumbFiles.length,
    missingInStorage,
    orphansInStorage,
    orphansInThumbnails,
    duplicateDbRecords,
    isSynced: missingInStorage.length === 0 && orphansInStorage.length === 0 && duplicateDbRecords.length === 0
  };
}

/**
 * Repair sync discrepancies
 */
export async function repairDatasetSync(datasetId: string, datasetSlug: string, syncData: SyncStats): Promise<PhotoHf[]> {
  for (const record of syncData.missingInStorage) {
    await deletePhotoRecord(record.id);
  }
  
  if (syncData.duplicateDbRecords && syncData.duplicateDbRecords.length > 0) {
    for (const record of syncData.duplicateDbRecords) {
      await deletePhotoRecord(record.id);
    }
  }
  
  const orphans = [...syncData.orphansInStorage, ...syncData.orphansInThumbnails];
  for (const orphan of orphans) {
    if (orphan.provider === 'huggingface' && HF_REPO) {
      try {
        const { deleteFile } = await import('@huggingface/hub');
        await deleteFile({
          repo: HF_REPO,
          credentials: { accessToken: HF_TOKEN },
          path: orphan.path
        });
      } catch (e) {
        console.warn(`Gagal menghapus orphan ${orphan.path} di Hugging Face:`, e);
      }
    } else {
      const { error: deleteErr } = await supabase.storage
        .from(SUPABASE_BUCKET)
        .remove([orphan.path]);
      if (deleteErr) {
        console.warn(`Gagal menghapus orphan ${orphan.path} di Supabase Storage:`, deleteErr);
      }
    }
  }
  
  const updatedPhotos = await getPhotos(datasetId);
  await updateDatasetPhotoCount(datasetId, updatedPhotos.length);
  
  return updatedPhotos;
}

/**
 * Get photos that are not synced to Hugging Face (provider = 'supabase')
 */
export async function getUnsyncedPhotos(datasetId: string): Promise<PhotoHf[]> {
  const { data, error } = await supabase
    .from('photos_hf')
    .select('*')
    .eq('dataset_id', datasetId)
    .eq('storage_provider', 'supabase');

  if (error) throw error;
  return data || [];
}

/**
 * Update sync status in bulk
 */
export async function updatePhotosToSynced(updates: Partial<PhotoHf>[]): Promise<PhotoHf[]> {
  const { data, error } = await supabase
    .from('photos_hf')
    .upsert(updates)
    .select();

  if (error) throw error;
  return data || [];
}
