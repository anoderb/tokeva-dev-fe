"use client";

import React, { useState } from 'react';
import { PhotoHf, getPhotoPublicUrl } from '../../lib/supabase';
import { Check, Trash2, Globe, Cloud, Eye, ZoomIn } from 'lucide-react';

interface GalleryGridProps {
  photos: PhotoHf[];
  onDeletePhoto: (photoId: string, storagePath: string) => Promise<void>;
  onBulkDelete?: (photoIds: string[], storagePaths: string[]) => Promise<void>;
}

export default function GalleryGrid({
  photos,
  onDeletePhoto,
  onBulkDelete
}: GalleryGridProps) {
  const [selectMode, setSelectMode] = useState<boolean>(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [previewPhoto, setPreviewPhoto] = useState<PhotoHf | null>(null);

  const handleSelectToggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === photos.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(photos.map(p => p.id)));
    }
  };

  const handleCancelSelect = () => {
    setSelectedIds(new Set());
    setSelectMode(false);
  };

  const handleDeleteSelected = async () => {
    if (!onBulkDelete || selectedIds.size === 0) return;
    if (confirm(`Apakah Anda yakin ingin menghapus ${selectedIds.size} foto terpilih?`)) {
      const ids = Array.from(selectedIds);
      const paths = photos.filter(p => selectedIds.has(p.id)).map(p => p.storage_path);
      try {
        await onBulkDelete(ids, paths);
        setSelectedIds(new Set());
        setSelectMode(false);
      } catch (err) {
        console.error("Gagal menghapus foto terpilih:", err);
      }
    }
  };

  const handleDeleteSingle = async (photo: PhotoHf) => {
    if (confirm("Apakah Anda yakin ingin menghapus foto ini?")) {
      try {
        await onDeletePhoto(photo.id, photo.storage_path);
      } catch (err) {
        console.error("Gagal menghapus foto:", err);
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Gallery Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 py-2 border-b border-slate-800">
        <div className="flex items-center space-x-2">
          <h3 className="font-semibold text-slate-100 text-base">Galeri Dataset</h3>
          <span className="px-2.5 py-0.5 text-xs font-semibold bg-slate-800 text-slate-400 rounded-full">
            {photos.length} Foto
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {selectMode ? (
            <div className="flex items-center space-x-2">
              <button
                onClick={handleSelectAll}
                className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors font-medium"
              >
                {selectedIds.size === photos.length ? "Batal Semua" : "Pilih Semua"}
              </button>
              {onBulkDelete && (
                <button
                  onClick={handleDeleteSelected}
                  disabled={selectedIds.size === 0}
                  className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white rounded-lg transition-colors font-medium flex items-center space-x-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus ({selectedIds.size})</span>
                </button>
              )}
              <button
                onClick={handleCancelSelect}
                className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors font-medium"
              >
                Selesai
              </button>
            </div>
          ) : (
            photos.length > 0 && (
              <button
                onClick={() => setSelectMode(true)}
                className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors font-medium flex items-center space-x-1"
              >
                <span>Pilih Foto</span>
              </button>
            )
          )}
        </div>
      </div>

      {/* Photos Grid */}
      {photos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-slate-500 text-center">
          <Globe className="w-10 h-10 mb-3 opacity-30" />
          <p className="text-sm font-medium text-slate-400">Belum ada foto dataset</p>
          <p className="text-xs mt-1">Gunakan kamera di atas untuk mengambil dataset produk.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {photos.map((photo) => {
            const isSelected = selectedIds.has(photo.id);
            const isHf = photo.storage_provider === 'huggingface';
            const publicUrl = getPhotoPublicUrl(photo);

            return (
              <div
                key={photo.id}
                onClick={() => selectMode && handleSelectToggle(photo.id)}
                className={`relative group rounded-xl overflow-hidden aspect-square border transition-all duration-300 cursor-pointer bg-slate-900 ${
                  isSelected
                    ? 'border-blue-500 ring-2 ring-blue-500/20'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Image */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={publicUrl}
                  alt={photo.file_name}
                  className="w-full h-full object-cover select-none transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />

                {/* Overlays */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-3">
                  <span className="text-[10px] text-slate-300 font-mono truncate max-w-[100px]">
                    {photo.file_name.split('_').pop()}
                  </span>
                  
                  {!selectMode && (
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewPhoto(photo);
                        }}
                        className="p-1.5 bg-slate-800/80 text-slate-200 hover:bg-slate-700 rounded-lg backdrop-blur-sm transition-colors"
                        title="Zoom"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSingle(photo);
                        }}
                        className="p-1.5 bg-red-650/80 text-red-200 hover:bg-red-600 rounded-lg backdrop-blur-sm transition-colors"
                        title="Hapus"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Storage Provider Indicators */}
                <div className="absolute top-2 left-2 flex items-center space-x-1">
                  {isHf ? (
                    <div className="px-1.5 py-0.5 bg-indigo-600/90 text-white text-[9px] font-bold rounded flex items-center space-x-0.5 shadow-md backdrop-blur-sm">
                      <Cloud className="w-2.5 h-2.5" />
                      <span>HF</span>
                    </div>
                  ) : (
                    <div className="px-1.5 py-0.5 bg-emerald-600/90 text-white text-[9px] font-bold rounded flex items-center space-x-0.5 shadow-md backdrop-blur-sm">
                      <Globe className="w-2.5 h-2.5" />
                      <span>Supa</span>
                    </div>
                  )}
                </div>

                {/* Selection checkbox */}
                {selectMode && (
                  <div className={`absolute top-2 right-2 w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                    isSelected
                      ? 'bg-blue-600 border-blue-500 text-white shadow-md'
                      : 'bg-slate-900/80 border-slate-700 text-transparent'
                  }`}>
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox Photo Preview Modal */}
      {previewPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-sm"
          onClick={() => setPreviewPhoto(null)}
        >
          <div
            className="relative max-w-3xl max-h-[85vh] rounded-xl overflow-hidden border border-slate-800 bg-slate-900 shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={getPhotoPublicUrl(previewPhoto)}
              alt={previewPhoto.file_name}
              className="max-w-full max-h-[75vh] object-contain mx-auto"
            />
            <div className="px-6 py-4 bg-slate-950 flex flex-wrap items-center justify-between gap-4 border-t border-slate-800">
              <div>
                <p className="text-slate-100 text-sm font-semibold truncate max-w-xs">{previewPhoto.file_name}</p>
                <p className="text-slate-400 text-xs mt-0.5">
                  {(previewPhoto.file_size / 1024).toFixed(1)} KB • {previewPhoto.width}x{previewPhoto.height} px
                </p>
              </div>
              <button
                onClick={() => setPreviewPhoto(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
