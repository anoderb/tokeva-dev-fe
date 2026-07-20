"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import JSZip from 'jszip';
import { getDatasets, getPhotos, getPhotoPublicUrl, DatasetHf } from '../../lib/supabase';
import {
  ArrowLeft,
  Search,
  Camera,
  FolderOpen,
  RefreshCw,
  Database,
  Layers,
  CheckCircle,
  Cloud,
  ChevronRight,
  Download
} from 'lucide-react';

export default function DatasetListPage() {
  const router = useRouter();
  const [datasets, setDatasets] = useState<DatasetHf[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Single Dataset ZIP state
  const [downloadingZipId, setDownloadingZipId] = useState<string | null>(null);
  const [zipProgressText, setZipProgressText] = useState<string>('');

  // ALL Datasets Master ZIP state
  const [downloadingAllZip, setDownloadingAllZip] = useState<boolean>(false);
  const [downloadAllProgressText, setDownloadAllProgressText] = useState<string>('');

  const fetchDatasets = async () => {
    try {
      setLoading(true);
      const data = await getDatasets();
      setDatasets(data);
    } catch (err) {
      console.error("Gagal mengambil dataset:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDatasets();
  }, []);

  // Handler unduh ZIP untuk 1 Dataset
  const handleDownloadDatasetZip = async (e: React.MouseEvent, dataset: DatasetHf) => {
    e.stopPropagation(); // Mencegah navigasi card click
    if (downloadingZipId || downloadingAllZip) return;

    setDownloadingZipId(dataset.id);
    setZipProgressText(`Memuat...`);

    try {
      const photos = await getPhotos(dataset.id);
      if (!photos || photos.length === 0) {
        alert("Dataset ini belum memiliki foto.");
        setDownloadingZipId(null);
        return;
      }

      const zip = new JSZip();
      const folder = zip.folder(dataset.slug);

      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i];
        setZipProgressText(`${i + 1}/${photos.length}`);

        const url = getPhotoPublicUrl(photo);
        if (!url) continue;

        const res = await fetch(url);
        if (!res.ok) continue;

        const blob = await res.blob();
        folder?.file(photo.file_name, blob);
      }

      setZipProgressText("ZIP...");
      const content = await zip.generateAsync({ type: "blob" });
      
      const a = document.createElement("a");
      a.href = URL.createObjectURL(content);
      a.download = `${dataset.slug}_dataset.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error("Gagal mengunduh ZIP dataset:", err);
      alert("Gagal mengunduh berkas ZIP.");
    } finally {
      setDownloadingZipId(null);
      setZipProgressText('');
    }
  };

  // Handler unduh SEMUA Dataset sekaligus ke dalam 1 Master ZIP
  const handleDownloadAllDatasetsZip = async () => {
    if (datasets.length === 0 || downloadingAllZip || downloadingZipId) return;

    const confirmDownload = window.confirm(`Apakah Anda yakin ingin mengunduh SELURUH ${datasets.length} dataset sekaligus ke dalam 1 file Master ZIP?`);
    if (!confirmDownload) return;

    setDownloadingAllZip(true);
    setDownloadAllProgressText("Mempersiapkan...");

    try {
      const zip = new JSZip();
      let totalPhotosProcessed = 0;

      for (let dIdx = 0; dIdx < datasets.length; dIdx++) {
        const dataset = datasets[dIdx];
        setDownloadAllProgressText(`Dataset (${dIdx + 1}/${datasets.length}): ${dataset.name}`);

        const photos = await getPhotos(dataset.id);
        if (!photos || photos.length === 0) continue;

        const folder = zip.folder(dataset.slug);

        for (let pIdx = 0; pIdx < photos.length; pIdx++) {
          const photo = photos[pIdx];
          setDownloadAllProgressText(`D${dIdx + 1}/${datasets.length} • F${pIdx + 1}/${photos.length}`);

          const url = getPhotoPublicUrl(photo);
          if (!url) continue;

          try {
            const res = await fetch(url);
            if (!res.ok) continue;

            const blob = await res.blob();
            folder?.file(photo.file_name, blob);
            totalPhotosProcessed++;
          } catch (e) {
            console.warn(`Gagal mengunduh foto ${photo.file_name}:`, e);
          }
        }
      }

      if (totalPhotosProcessed === 0) {
        alert("Tidak ada foto dataset yang ditemukan untuk diunduh.");
        setDownloadingAllZip(false);
        setDownloadAllProgressText('');
        return;
      }

      setDownloadAllProgressText("Kompresi Master ZIP...");
      const content = await zip.generateAsync({ type: "blob" });

      const a = document.createElement("a");
      a.href = URL.createObjectURL(content);
      a.download = `tokiva_all_datasets_master.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error("Gagal mengunduh Master ZIP:", err);
      alert("Gagal mengunduh Master ZIP Dataset.");
    } finally {
      setDownloadingAllZip(false);
      setDownloadAllProgressText('');
    }
  };

  const filteredDatasets = datasets.filter((d) =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPhotoCount = datasets.reduce((acc, d) => acc + (d.photo_count || 0), 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 flex flex-col justify-start items-center">
      <div className="w-full max-w-5xl space-y-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-900 pb-6">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.push('/')}
              className="p-2 hover:bg-slate-900 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Dataset Manager</h1>
              <p className="text-xs text-slate-500 mt-1">Daftar dataset foto per kategori produk AI ({totalPhotoCount} Total Foto)</p>
            </div>
          </div>

          {/* Master Action Buttons */}
          <div className="flex items-center space-x-3">
            <div className="hidden md:flex items-center space-x-2 bg-slate-900/40 border border-slate-900 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-400">
              <Layers className="w-4 h-4 text-indigo-400" />
              <span>{datasets.length} Dataset</span>
            </div>

            <button
              onClick={handleDownloadAllDatasetsZip}
              disabled={downloadingAllZip || datasets.length === 0}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 border border-indigo-500 text-white font-bold rounded-xl flex items-center space-x-2 text-xs transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
            >
              {downloadingAllZip ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span className="font-mono text-[11px]">{downloadAllProgressText}</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Unduh Semua Dataset (ZIP All)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative w-full max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Cari dataset produk..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900/40 border border-slate-900 focus:border-slate-800 rounded-xl text-xs placeholder:text-slate-500 focus:outline-none transition-colors"
          />
        </div>

        {/* Content Section */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500">
            <RefreshCw className="w-8 h-8 animate-spin mb-3 text-blue-500" />
            <span className="text-xs">Memuat daftar dataset...</span>
          </div>
        ) : filteredDatasets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-500 text-center bg-slate-900/10 border border-slate-900 rounded-2xl">
            <FolderOpen className="w-10 h-10 mb-3 opacity-30 text-indigo-400" />
            <p className="text-sm font-semibold text-slate-400">Tidak ada dataset ditemukan</p>
            <p className="text-xs mt-1">Daftarkan SKU produk terlebih dahulu di menu Master Produk.</p>
            <Link
              href="/master-produk"
              className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-xs transition-colors"
            >
              Master Produk AI
            </Link>
          </div>
        ) : (
          /* Datasets Card Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {filteredDatasets.map((dataset) => (
              <div
                key={dataset.id}
                className="p-5 rounded-2xl bg-slate-900/20 border border-slate-900 hover:border-slate-800 hover:bg-slate-900/30 transition-all flex flex-col justify-between h-[190px] group cursor-pointer"
                onClick={() => router.push(`/dataset/collect?id=${dataset.id}&slug=${dataset.slug}&name=${encodeURIComponent(dataset.name)}`)}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <h3 className="font-bold text-slate-200 text-sm group-hover:text-blue-400 transition-colors">
                      {dataset.name}
                    </h3>
                    <span className="px-2 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-900 rounded-md">
                      {dataset.photo_count} file
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 font-mono tracking-wide truncate">
                    Slug: {dataset.slug}
                  </p>
                </div>

                <div className="flex items-center justify-between border-t border-slate-900/80 pt-4">
                  <div className="flex items-center space-x-1 text-[10px] text-slate-500">
                    <Cloud className="w-3.5 h-3.5 text-blue-500" />
                    <span>HF Synced</span>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={(e) => handleDownloadDatasetZip(e, dataset)}
                      disabled={!!downloadingZipId || downloadingAllZip || dataset.photo_count === 0}
                      title="Unduh Dataset ini ke ZIP"
                      className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-blue-600/20 disabled:opacity-40 text-slate-300 hover:text-blue-400 border border-slate-800 hover:border-blue-500/40 transition-all flex items-center space-x-1"
                    >
                      {downloadingZipId === dataset.id ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-400" />
                          <span className="text-[10px] font-mono">{zipProgressText}</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-3.5 h-3.5 text-blue-400" />
                          <span className="text-[10px] font-semibold">ZIP</span>
                        </>
                      )}
                    </button>

                    <span className="text-[11px] font-bold text-blue-400 group-hover:text-blue-300 flex items-center space-x-0.5">
                      <span>Capture</span>
                      <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
