"use client";

import React, { useState, useEffect, useRef, useTransition, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase, PhotoHf, getPhotos, deletePhotoRecord } from '../../../lib/supabase';
import { uploadSinglePhoto, deletePhoto, deletePhotosBulk } from '../../../lib/upload';
import { processImage, checkQuality, SmartFilter } from '../../../lib/image-processor';
import { useCamera } from '../../../hooks/useCamera';
import { useUploadQueue, QueueStats } from '../../../hooks/useUploadQueue';
import { useFrameExtractor } from '../../../hooks/useFrameExtractor';
import CameraFeed from '../../../components/ui/CameraFeed';
import GalleryGrid from '../../../components/ui/GalleryGrid';
import {
  ArrowLeft,
  Camera,
  Video as VideoIcon,
  Upload,
  Play,
  RotateCcw,
  CheckCircle,
  AlertTriangle,
  FolderOpen,
  Trash2,
  Download,
  Settings,
  RefreshCw,
  Plus
} from 'lucide-react';
import JSZip from 'jszip';

type TabMode = 'photo' | 'video' | 'upload-photo' | 'upload-video';

function CollectPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const datasetId = searchParams.get('id') || '';
  const datasetSlug = searchParams.get('slug') || '';
  const datasetName = searchParams.get('name') || 'Dataset';

  const [activeTab, setActiveTab] = useState<TabMode>('photo');
  const [photos, setPhotos] = useState<PhotoHf[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Camera Overlay Control
  const [isCameraOpen, setIsCameraOpen] = useState<boolean>(false);
  const [cameraMode, setCameraMode] = useState<'photo' | 'video'>('photo');

  // Video State (Local recording)
  const [recordedVideo, setRecordedVideo] = useState<Blob | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [videoMetadata, setVideoMetadata] = useState<any>(null);
  const [extractConfig, setExtractConfig] = useState({
    mode: 'fps' as 'fps' | 'interval',
    value: 2,
    smartFilter: true,
    threshold: 0.12
  });
  const [extractionEstimate, setExtractionEstimate] = useState<any>(null);

  // Upload Video State (Uploaded files)
  const [uploadedVideo, setUploadedVideo] = useState<File | null>(null);
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState<string>('');
  const [uploadedVideoMetadata, setUploadedVideoMetadata] = useState<any>(null);
  const [uploadedExtractionEstimate, setUploadedExtractionEstimate] = useState<any>(null);

  // Local uploaded images previews
  const [selectedLocalImages, setSelectedLocalImages] = useState<File[]>([]);
  const [localImagePreviews, setLocalImagePreviews] = useState<string[]>([]);

  // Extraction Progress State
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [extractionStats, setExtractionStats] = useState({
    current: 0,
    total: 0,
    percent: 0,
    statusText: ''
  });

  // Extraction Summary Results
  const [summaryResult, setSummaryResult] = useState<{
    show: boolean;
    extracted: number;
    saved: number;
    discarded: number;
    beforeSize: string;
    afterSize: string;
    savingPercent: number;
  } | null>(null);

  const {
    getVideoMetadata,
    estimateExtraction,
    extractFrames,
    formatSize,
    formatTime
  } = useFrameExtractor();

  // Load photos belonging to this dataset
  const fetchPhotos = useCallback(async () => {
    if (!datasetId) return;
    try {
      setLoading(true);
      const data = await getPhotos(datasetId);
      setPhotos(data);
    } catch (err) {
      console.error("Gagal memuat foto:", err);
    } finally {
      setLoading(false);
    }
  }, [datasetId]);

  useEffect(() => {
    fetchPhotos();
  }, [fetchPhotos]);

  // Upload Queue Handler
  const handleItemSuccess = (newPhoto: PhotoHf) => {
    setPhotos((prev) => [...prev, newPhoto]);
  };

  const {
    queue,
    stats: uploadQueueStats,
    add: addToQueue,
    addBatch: addBatchToQueue,
    retryAllFailed,
    clear: clearQueue
  } = useUploadQueue({
    onItemSuccess: handleItemSuccess,
    onItemFailure: (id, err, perm) => {
      console.warn(`Queue failure on ${id}: ${err}. Permanent? ${perm}`);
    }
  });

  // Clean local previews URLs on unmount
  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
      if (uploadedVideoUrl) URL.revokeObjectURL(uploadedVideoUrl);
      localImagePreviews.forEach(URL.revokeObjectURL);
    };
  }, [videoUrl, uploadedVideoUrl, localImagePreviews]);

  // Estimate extraction on video load / config change (Local Video)
  useEffect(() => {
    if (recordedVideo && videoMetadata) {
      const estimate = estimateExtraction(videoMetadata, {
        mode: extractConfig.mode,
        value: extractConfig.value
      });
      setExtractionEstimate(estimate);
    }
  }, [recordedVideo, videoMetadata, extractConfig.mode, extractConfig.value, estimateExtraction]);

  // Estimate extraction on video load / config change (Uploaded Video)
  useEffect(() => {
    if (uploadedVideo && uploadedVideoMetadata) {
      const estimate = estimateExtraction(uploadedVideoMetadata, {
        mode: extractConfig.mode,
        value: extractConfig.value
      });
      setUploadedExtractionEstimate(estimate);
    }
  }, [uploadedVideo, uploadedVideoMetadata, extractConfig.mode, extractConfig.value, estimateExtraction]);

  // Single Frame Capture from camera overlay
  const handlePhotoCaptured = async (rawBlob: Blob) => {
    try {
      const qualityResult = await checkQuality(rawBlob);
      if (!qualityResult.passed) {
        const issueMap: Record<string, string> = {
          dark: 'gelap',
          bright: 'terlalu terang',
          blur: 'buram / blur',
          noise: 'noise / berbintik',
          small: 'ukuran terlalu kecil',
          corrupt: 'gambar rusak'
        };
        const issueText = qualityResult.issues.map(i => issueMap[i] || i).join(', ');
        const confirmSave = window.confirm(`Kualitas foto kurang baik (${issueText}).\n\nApakah Anda tetap ingin menyimpan?`);
        if (!confirmSave) {
          return;
        }
      }

      const processed = await processImage(rawBlob);
      addToQueue({
        datasetId,
        datasetSlug,
        blob: processed.processed,
        thumbnail: processed.thumbnail,
        width: processed.width,
        height: processed.height
      });
    } catch (err) {
      console.error("Gagal memproses tangkapan foto:", err);
    }
  };

  // Video recording completed in camera overlay
  const handleVideoRecorded = async (videoBlob: Blob) => {
    setIsCameraOpen(false);
    setRecordedVideo(videoBlob);
    const url = URL.createObjectURL(videoBlob);
    setVideoUrl(url);

    try {
      const metadata = await getVideoMetadata(videoBlob);
      setVideoMetadata(metadata);
    } catch (err) {
      console.error("Gagal memuat metadata video:", err);
    }
  };

  // Extract frames workflow (Unified for recorded and uploaded videos)
  const runFrameExtraction = async (videoBlob: Blob) => {
    if (!videoBlob) return;
    setIsExtracting(true);
    setSummaryResult(null);

    const smartFilter = new SmartFilter(extractConfig.threshold);
    let savedCount = 0;
    let discardedCount = 0;
    let totalAfterSize = 0;

    try {
      await extractFrames(
        videoBlob,
        { mode: extractConfig.mode, value: extractConfig.value },
        async (frameBlob, timestamp, index) => {
          // 1. Check Image Quality
          const quality = await checkQuality(frameBlob);
          if (!quality.passed) {
            discardedCount++;
            return;
          }

          // 2. Resize and Compress Image
          const processed = await processImage(frameBlob);

          // 3. Smart Filter check
          if (extractConfig.smartFilter) {
            const keep = await smartFilter.shouldKeepFrame(processed.processed);
            if (!keep) {
              discardedCount++;
              return;
            }
          }

          // 4. Add to upload queue
          addToQueue({
            datasetId,
            datasetSlug,
            blob: processed.processed,
            thumbnail: processed.thumbnail,
            width: processed.width,
            height: processed.height
          });

          savedCount++;
          totalAfterSize += processed.processedSize;
        },
        (current, total, percent) => {
          setExtractionStats({
            current,
            total,
            percent,
            statusText: `Memproses frame ${current} dari ${total} (${percent}%)`
          });
        }
      );

      // Show summary card
      const beforeSizeFormatted = formatSize(videoBlob.size);
      const afterSizeFormatted = formatSize(totalAfterSize);
      const savingPercent = videoBlob.size > 0 
        ? Math.round(((videoBlob.size - totalAfterSize) / videoBlob.size) * 100) 
        : 0;

      setSummaryResult({
        show: true,
        extracted: savedCount + discardedCount,
        saved: savedCount,
        discarded: discardedCount,
        beforeSize: beforeSizeFormatted,
        afterSize: afterSizeFormatted,
        savingPercent
      });

      // Clear video preview states
      setRecordedVideo(null);
      setVideoUrl('');
      setUploadedVideo(null);
      setUploadedVideoUrl('');

    } catch (err) {
      console.error("Gagal melakukan ekstraksi frame:", err);
      alert("Terjadi kesalahan saat mengekstrak video.");
    } finally {
      setIsExtracting(false);
    }
  };

  // Image Upload File Dropper
  const handleImageFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setSelectedLocalImages((prev) => [...prev, ...files]);

    const newPreviews = files.map(file => URL.createObjectURL(file));
    setLocalImagePreviews((prev) => [...prev, ...newPreviews]);
  };

  const handleUploadSelectedImages = async () => {
    if (selectedLocalImages.length === 0) return;

    for (let i = 0; i < selectedLocalImages.length; i++) {
      const file = selectedLocalImages[i];
      try {
        const quality = await checkQuality(file);
        if (!quality.passed) {
          console.warn(`File ${file.name} skip karena kualitas:`, quality.issues);
          continue;
        }

        const processed = await processImage(file);
        addToQueue({
          datasetId,
          datasetSlug,
          blob: processed.processed,
          thumbnail: processed.thumbnail,
          width: processed.width,
          height: processed.height
        });
      } catch (err) {
        console.error(`Gagal upload file ${file.name}:`, err);
      }
    }

    // Clean states
    setSelectedLocalImages([]);
    localImagePreviews.forEach(URL.revokeObjectURL);
    setLocalImagePreviews([]);
  };

  // Video Upload File Dropper
  const handleVideoFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedVideo(file);
    const url = URL.createObjectURL(file);
    setUploadedVideoUrl(url);

    try {
      const metadata = await getVideoMetadata(file);
      setUploadedVideoMetadata(metadata);
    } catch (err) {
      console.error("Gagal memuat metadata video file:", err);
    }
  };

  // Delete Individual photo from DB
  const handleDeletePhoto = async (photoId: string, storagePath: string) => {
    try {
      await deletePhoto(photoId, storagePath);
      setPhotos((prev) => prev.filter(p => p.id !== photoId));
    } catch (err) {
      console.error("Gagal menghapus foto:", err);
    }
  };

  // Bulk Delete photo from DB
  const handleBulkDelete = async (photoIds: string[], storagePaths: string[]) => {
    const photosToDelete = photos.filter(p => photoIds.includes(p.id));
    try {
      await deletePhotosBulk(photosToDelete);
      setPhotos((prev) => prev.filter(p => !photoIds.includes(p.id)));
    } catch (err) {
      console.error("Gagal bulk delete:", err);
    }
  };

  // ZIP download generator
  const handleDownloadZip = async () => {
    if (photos.length === 0) return;
    const zip = new JSZip();
    const folder = zip.folder(datasetSlug);

    alert("Mengekspor berkas dataset ke ZIP. Mohon tunggu...");

    try {
      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i];
        const res = await fetch(photo.storage_path.startsWith('data/') 
          ? `https://huggingface.co/datasets/Anoderb/dataset-collect/resolve/main/${photo.storage_path}`
          : supabase.storage.from('dataset-photos').getPublicUrl(photo.storage_path).data.publicUrl);
        
        const blob = await res.blob();
        folder?.file(photo.file_name, blob);
      }

      const content = await zip.generateAsync({ type: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(content);
      a.download = `${datasetSlug}_dataset.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error("Gagal mendownload ZIP:", err);
      alert("Gagal mengunduh berkas ZIP.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 flex flex-col">
      {/* Header Back Button */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-slate-900 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-100 tracking-tight">{datasetName}</h1>
            <p className="text-xs text-slate-500 mt-1">Slug: {datasetSlug} • ID: {datasetId}</p>
          </div>
        </div>

        <button
          onClick={handleDownloadZip}
          disabled={photos.length === 0}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-slate-900 border border-slate-800 text-slate-300 font-semibold rounded-lg flex items-center space-x-2 text-xs transition-colors"
        >
          <Download className="w-4 h-4" />
          <span>Unduh ZIP</span>
        </button>
      </div>

      {/* Mode Selector Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
        <button
          onClick={() => setActiveTab('photo')}
          className={`flex items-center justify-center space-x-2 py-3 px-4 rounded-xl border text-xs font-semibold transition-all ${
            activeTab === 'photo'
              ? 'bg-blue-600/10 border-blue-500/50 text-blue-400'
              : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:bg-slate-900'
          }`}
        >
          <Camera className="w-4 h-4" />
          <span>Ambil Foto</span>
        </button>
        <button
          onClick={() => setActiveTab('video')}
          className={`flex items-center justify-center space-x-2 py-3 px-4 rounded-xl border text-xs font-semibold transition-all ${
            activeTab === 'video'
              ? 'bg-blue-600/10 border-blue-500/50 text-blue-400'
              : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:bg-slate-900'
          }`}
        >
          <VideoIcon className="w-4 h-4" />
          <span>Rekam Video</span>
        </button>
        <button
          onClick={() => setActiveTab('upload-photo')}
          className={`flex items-center justify-center space-x-2 py-3 px-4 rounded-xl border text-xs font-semibold transition-all ${
            activeTab === 'upload-photo'
              ? 'bg-blue-600/10 border-blue-500/50 text-blue-400'
              : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:bg-slate-900'
          }`}
        >
          <Upload className="w-4 h-4" />
          <span>Upload Foto</span>
        </button>
        <button
          onClick={() => setActiveTab('upload-video')}
          className={`flex items-center justify-center space-x-2 py-3 px-4 rounded-xl border text-xs font-semibold transition-all ${
            activeTab === 'upload-video'
              ? 'bg-blue-600/10 border-blue-500/50 text-blue-400'
              : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:bg-slate-900'
          }`}
        >
          <Upload className="w-4 h-4" />
          <span>Upload Video</span>
        </button>
      </div>

      {/* Main Content Area Card */}
      <div className="p-6 bg-slate-900/40 border border-slate-900 rounded-2xl mb-8 flex flex-col items-center justify-center min-h-[220px]">
        {activeTab === 'photo' && (
          <div className="text-center max-w-sm py-4">
            <Camera className="w-12 h-12 mx-auto text-blue-500 mb-4 opacity-80" />
            <h3 className="font-semibold text-slate-200 text-sm mb-1.5">Kamera Pengumpul Dataset</h3>
            <p className="text-xs text-slate-500 mb-6 leading-relaxed">
              Gunakan kamera untuk menangkap foto produk secara berkala dari berbagai sudut.
            </p>
            <button
              onClick={() => {
                setCameraMode('photo');
                setIsCameraOpen(true);
              }}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20 active:scale-95 transition-all flex items-center space-x-2 mx-auto"
            >
              <Camera className="w-4 h-4" />
              <span>Buka Kamera</span>
            </button>
          </div>
        )}

        {activeTab === 'video' && (
          <div className="w-full">
            {videoUrl ? (
              <div className="space-y-4 max-w-xl mx-auto">
                <video src={videoUrl} controls className="w-full aspect-[4/3] rounded-xl overflow-hidden bg-black border border-slate-800" />
                
                {/* Extraction config inputs */}
                <div className="p-4 bg-slate-950/50 border border-slate-850 rounded-xl space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-850 pb-2 mb-2">
                    <span className="text-xs font-semibold text-slate-300">Konfigurasi Ekstraksi Frame</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Mode</label>
                      <select
                        value={extractConfig.mode}
                        onChange={(e) => setExtractConfig(prev => ({ ...prev, mode: e.target.value as any }))}
                        className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs"
                      >
                        <option value="fps">Frame Per Second (FPS)</option>
                        <option value="interval">Interval (Detik)</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Value</label>
                      <input
                        type="number"
                        step="0.1"
                        value={extractConfig.value}
                        onChange={(e) => setExtractConfig(prev => ({ ...prev, value: Number(e.target.value) }))}
                        className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs"
                      />
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 pt-2 border-t border-slate-850">
                    <input
                      type="checkbox"
                      id="smart-filter"
                      checked={extractConfig.smartFilter}
                      onChange={(e) => setExtractConfig(prev => ({ ...prev, smartFilter: e.target.checked }))}
                      className="w-4 h-4 rounded bg-slate-900 border-slate-800 text-blue-600"
                    />
                    <label htmlFor="smart-filter" className="text-xs text-slate-400">Smart Frame Filter (Skip frame mirip)</label>
                  </div>
                </div>

                {extractionEstimate && (
                  <div className="p-3 bg-blue-950/20 border border-blue-900/30 rounded-xl flex items-center justify-between text-xs text-blue-400">
                    <span>Estimasi: {extractionEstimate.estimatedFrames} frame ({extractionEstimate.estimatedStorage})</span>
                    <span>Waktu: {extractionEstimate.formattedEstimatedTime}</span>
                  </div>
                )}

                <div className="flex space-x-3">
                  <button
                    onClick={() => {
                      setRecordedVideo(null);
                      setVideoUrl('');
                    }}
                    className="flex-1 py-2.5 border border-slate-800 hover:bg-slate-900 text-slate-400 hover:text-slate-200 text-xs font-semibold rounded-xl transition-colors"
                  >
                    Rekam Ulang
                  </button>
                  <button
                    onClick={() => recordedVideo && runFrameExtraction(recordedVideo)}
                    className="flex-[2] py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-500/10 transition-colors"
                  >
                    Ekstrak & Upload
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center max-w-sm py-4 mx-auto">
                <VideoIcon className="w-12 h-12 mx-auto text-blue-500 mb-4 opacity-80" />
                <h3 className="font-semibold text-slate-200 text-sm mb-1.5">Merekam Video</h3>
                <p className="text-xs text-slate-500 mb-6 leading-relaxed">
                  Rekam perputaran/pergerakan produk, lalu ekstrak frame-framenya sebagai dataset.
                </p>
                <button
                  onClick={() => {
                    setCameraMode('video');
                    setIsCameraOpen(true);
                  }}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20 active:scale-95 transition-all flex items-center space-x-2 mx-auto"
                >
                  <VideoIcon className="w-4 h-4" />
                  <span>Buka Kamera</span>
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'upload-photo' && (
          <div className="w-full max-w-xl">
            {localImagePreviews.length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">{selectedLocalImages.length} Foto Terpilih</span>
                  <button
                    onClick={() => {
                      setSelectedLocalImages([]);
                      setLocalImagePreviews([]);
                    }}
                    className="text-xs text-red-500 hover:underline"
                  >
                    Hapus Pilihan
                  </button>
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-6 gap-3 max-h-[220px] overflow-y-auto p-2 border border-slate-900 bg-slate-950/20 rounded-xl">
                  {localImagePreviews.map((src, index) => (
                    <div key={index} className="relative rounded-lg overflow-hidden aspect-square border border-slate-800 bg-slate-900">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt="preview" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleUploadSelectedImages}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-500/10 transition-colors"
                >
                  Mulai Pemrosesan & Upload
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-800 hover:border-slate-700 bg-slate-950/20 hover:bg-slate-950/40 rounded-2xl p-8 cursor-pointer transition-colors text-center w-full">
                <Upload className="w-10 h-10 text-slate-500 mb-3" />
                <span className="text-xs font-semibold text-slate-300">Pilih file foto di komputer</span>
                <span className="text-[10px] text-slate-500 mt-1">Mendukung format JPG, JPEG, PNG</span>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleImageFileSelect}
                  className="hidden"
                />
              </label>
            )}
          </div>
        )}

        {activeTab === 'upload-video' && (
          <div className="w-full max-w-xl">
            {uploadedVideoUrl ? (
              <div className="space-y-4">
                <video src={uploadedVideoUrl} controls className="w-full aspect-[4/3] rounded-xl overflow-hidden bg-black border border-slate-800" />
                
                <div className="p-4 bg-slate-950/50 border border-slate-850 rounded-xl space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-850 pb-2 mb-2">
                    <span className="text-xs font-semibold text-slate-300">Konfigurasi Ekstraksi Frame</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Mode</label>
                      <select
                        value={extractConfig.mode}
                        onChange={(e) => setExtractConfig(prev => ({ ...prev, mode: e.target.value as any }))}
                        className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs"
                      >
                        <option value="fps">Frame Per Second (FPS)</option>
                        <option value="interval">Interval (Detik)</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Value</label>
                      <input
                        type="number"
                        step="0.1"
                        value={extractConfig.value}
                        onChange={(e) => setExtractConfig(prev => ({ ...prev, value: Number(e.target.value) }))}
                        className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs"
                      />
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 pt-2 border-t border-slate-850">
                    <input
                      type="checkbox"
                      id="uploaded-smart-filter"
                      checked={extractConfig.smartFilter}
                      onChange={(e) => setExtractConfig(prev => ({ ...prev, smartFilter: e.target.checked }))}
                      className="w-4 h-4 rounded bg-slate-900 border-slate-800 text-blue-600"
                    />
                    <label htmlFor="uploaded-smart-filter" className="text-xs text-slate-400">Smart Frame Filter (Skip frame mirip)</label>
                  </div>
                </div>

                {uploadedExtractionEstimate && (
                  <div className="p-3 bg-blue-950/20 border border-blue-900/30 rounded-xl flex items-center justify-between text-xs text-blue-400">
                    <span>Estimasi: {uploadedExtractionEstimate.estimatedFrames} frame ({uploadedExtractionEstimate.estimatedStorage})</span>
                    <span>Waktu: {uploadedExtractionEstimate.formattedEstimatedTime}</span>
                  </div>
                )}

                <div className="flex space-x-3">
                  <button
                    onClick={() => {
                      setUploadedVideo(null);
                      setUploadedVideoUrl('');
                    }}
                    className="flex-1 py-2.5 border border-slate-800 hover:bg-slate-900 text-slate-400 hover:text-slate-200 text-xs font-semibold rounded-xl transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    onClick={() => uploadedVideo && runFrameExtraction(uploadedVideo)}
                    className="flex-[2] py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-500/10 transition-colors"
                  >
                    Ekstrak & Upload
                  </button>
                </div>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-800 hover:border-slate-700 bg-slate-950/20 hover:bg-slate-950/40 rounded-2xl p-8 cursor-pointer transition-colors text-center w-full">
                <Upload className="w-10 h-10 text-slate-500 mb-3" />
                <span className="text-xs font-semibold text-slate-300">Pilih file video di komputer</span>
                <span className="text-[10px] text-slate-500 mt-1">Mendukung format MP4, WEBM, MOV</span>
                <input
                  type="file"
                  accept="video/*"
                  onChange={handleVideoFileSelect}
                  className="hidden"
                />
              </label>
            )}
          </div>
        )}
      </div>

      {/* Frame Extraction Progress Interface */}
      {isExtracting && (
        <div className="p-5 bg-slate-900/80 border border-slate-800 rounded-2xl mb-8 space-y-4">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300">{extractionStats.statusText}</span>
            <span className="font-bold text-blue-400">{extractionStats.percent}%</span>
          </div>
          <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-850">
            <div className="bg-blue-500 h-full transition-all duration-300" style={{ width: `${extractionStats.percent}%` }} />
          </div>
        </div>
      )}

      {/* Extraction Summary Result Box */}
      {summaryResult && summaryResult.show && (
        <div className="p-5 bg-emerald-950/25 border border-emerald-900/35 rounded-2xl mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <CheckCircle className="w-10 h-10 text-emerald-500" />
            <div>
              <h4 className="font-bold text-slate-100 text-sm">{summaryResult.savingPercent}% Lebih Hemat Penyimpanan!</h4>
              <p className="text-slate-400 text-xs mt-0.5">
                Mengekstrak {summaryResult.extracted} frame. Menyimpan {summaryResult.saved} frame & membuang {summaryResult.discarded} frame duplikat/buram.
              </p>
              <p className="text-[10px] text-slate-500 mt-1">
                Ukuran video: {summaryResult.beforeSize} • Ukuran frame tersimpan: {summaryResult.afterSize}
              </p>
            </div>
          </div>
          <button
            onClick={() => setSummaryResult(null)}
            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-555 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            Oke
          </button>
        </div>
      )}

      {/* Active Upload Queue Status HUD */}
      {uploadQueueStats.totalCount > 0 && uploadQueueStats.pendingCount > 0 && (
        <div className="p-5 bg-slate-900/80 border border-slate-800 rounded-2xl mb-8 space-y-4">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2">
              <RefreshCw className="w-4 h-4 text-blue-400 animate-spin" />
              <span className="font-semibold text-slate-300">
                Sedang mengunggah ke Supabase Storage ({uploadQueueStats.completedCount}/{uploadQueueStats.totalCount})
              </span>
            </div>
            <span className="font-bold text-blue-400">{uploadQueueStats.progressPercent}%</span>
          </div>
          <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-850">
            <div className="bg-blue-500 h-full transition-all duration-300" style={{ width: `${uploadQueueStats.progressPercent}%` }} />
          </div>
          <div className="text-[10px] text-slate-500 flex items-center justify-between">
            <span>Antrean pending: {uploadQueueStats.pendingCount} • Upload paralel: {uploadQueueStats.uploadingCount}</span>
            {uploadQueueStats.failedCount > 0 && (
              <button onClick={retryAllFailed} className="text-red-400 hover:underline">
                Coba lagi {uploadQueueStats.failedCount} upload gagal
              </button>
            )}
          </div>
        </div>
      )}

      {/* Gallery Grid Section */}
      <div className="flex-1 bg-slate-900/20 border border-slate-900/50 rounded-2xl p-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-500">
            <RefreshCw className="w-8 h-8 animate-spin mb-3 text-blue-500" />
            <span className="text-xs">Memuat galeri foto...</span>
          </div>
        ) : (
          <GalleryGrid
            photos={photos}
            onDeletePhoto={handleDeletePhoto}
            onBulkDelete={handleBulkDelete}
          />
        )}
      </div>

      {/* Fullscreen Camera Overlay Component */}
      <CameraFeed
        isActive={isCameraOpen}
        title={cameraMode === 'photo' ? "Ambil Foto Dataset" : "Rekam Video Dataset"}
        onCapture={handlePhotoCaptured}
        onVideoRecorded={cameraMode === 'video' ? handleVideoRecorded : undefined}
        onClose={() => setIsCameraOpen(false)}
      />
    </div>
  );
}

export default function CollectPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center space-y-4">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
        <span className="text-xs text-slate-500">Memuat halaman pengumpulan dataset...</span>
      </div>
    }>
      <CollectPageContent />
    </Suspense>
  );
}
