"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Link as LinkIcon,
  Plus,
  Trash2,
  Clock,
  Eye,
  RefreshCw,
  FolderLock
} from 'lucide-react';

interface UnknownItem {
  id: string;
  imgUrl: string;
  model: string;
  timestamp: string;
  cashierName: string;
}

export default function UnknownPage() {
  const router = useRouter();
  const [unknownQueue, setUnknownQueue] = useState<UnknownItem[]>([
    {
      id: "unk-001",
      imgUrl: "https://mkfokoifzniofquqbwsi.supabase.co/storage/v1/object/public/dataset-photos/indomie-goreng/indomie-goreng_x8y2z_001.jpg",
      model: "v1.2-stable",
      timestamp: "17 Jul 2026, 14:12 WIB",
      cashierName: "Budi (Shift Pagi)"
    }
  ]);

  const [linkTarget, setLinkTarget] = useState<string>('');

  const handleLink = (id: string) => {
    if (!linkTarget) {
      alert("Pilih produk tujuan terlebih dahulu!");
      return;
    }
    setUnknownQueue(prev => prev.filter(item => item.id !== id));
    alert(`Sukses menautkan ke ${linkTarget}! Ditambahkan ke folder dataset.`);
  };

  const handleDelete = (id: string) => {
    if (confirm("Apakah Anda yakin ingin menghapus tangkapan ini?")) {
      setUnknownQueue(prev => prev.filter(item => item.id !== id));
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 flex flex-col justify-start items-center">
      <div className="w-full max-w-4xl space-y-8">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-900 pb-6">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.push('/')}
              className="p-2 hover:bg-slate-900 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Produk Unknown</h1>
              <p className="text-xs text-slate-500 mt-1">Tinjau gambar produk baru/tidak dikenal yang terkirim dari kasir</p>
            </div>
          </div>

          <div className="flex items-center space-x-2 bg-slate-900/40 border border-slate-900 rounded-xl px-4 py-2 text-xs font-semibold text-slate-400">
            <FolderLock className="w-4 h-4 text-amber-500" />
            <span>{unknownQueue.length} Unknown Frame</span>
          </div>
        </div>

        {/* Content */}
        {unknownQueue.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500 text-center bg-slate-900/10 border border-slate-900 rounded-2xl">
            <Clock className="w-10 h-10 mb-3 opacity-30 text-emerald-400" />
            <p className="text-sm font-semibold text-slate-400">Antrean Bersih!</p>
            <p className="text-xs mt-1">Tidak ada produk tidak dikenal yang pending untuk ditinjau.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {unknownQueue.map((item) => (
              <div
                key={item.id}
                className="p-5 rounded-2xl bg-slate-900/20 border border-slate-900 flex flex-col md:flex-row gap-6 hover:border-slate-850 transition-all"
              >
                {/* Captured Preview */}
                <div className="w-full md:w-44 aspect-square rounded-xl overflow-hidden bg-slate-950 border border-slate-850 relative group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.imgUrl} alt="unknown product" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <a href={item.imgUrl} target="_blank" rel="noreferrer" className="p-2 bg-slate-800 text-slate-200 hover:bg-slate-700 rounded-lg text-xs font-semibold flex items-center space-x-1">
                      <Eye className="w-3.5 h-3.5" />
                      <span>Lihat Asli</span>
                    </a>
                  </div>
                </div>

                {/* Linking Form & Metadata */}
                <div className="flex-1 flex flex-col justify-between py-1 space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div className="space-y-1">
                      <span className="text-slate-500 font-bold uppercase tracking-wider text-[9px]">Pengirim / Waktu</span>
                      <p className="text-slate-350">{item.cashierName}</p>
                      <p className="text-slate-500 text-[10px]">{item.timestamp}</p>
                    </div>

                    <div className="space-y-1">
                      <span className="text-slate-500 font-bold uppercase tracking-wider text-[9px]">Model Version Failure</span>
                      <p className="text-slate-350">{item.model}</p>
                    </div>
                  </div>

                  {/* Actions Form */}
                  <div className="space-y-3 pt-3 border-t border-slate-900/60">
                    <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">Tautkan ke Master Produk AI</label>
                    <div className="flex space-x-2">
                      <select
                        value={linkTarget}
                        onChange={(e) => setLinkTarget(e.target.value)}
                        className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs"
                      >
                        <option value="">-- Pilih Master Produk --</option>
                        <option value="indomie-goreng">Indomie Goreng</option>
                        <option value="susu-uht-ultra">Susu UHT Ultra</option>
                        <option value="sari-roti-tawar">Sari Roti Tawar</option>
                      </select>
                      
                      <button
                        onClick={() => handleLink(item.id)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs flex items-center space-x-1 transition-colors"
                      >
                        <LinkIcon className="w-4 h-4" />
                        <span>Tautkan</span>
                      </button>
                    </div>
                  </div>

                  {/* Reject / Delete */}
                  <div className="flex justify-end pt-2 border-t border-slate-900/40">
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="px-3 py-1.5 text-xs text-red-500 hover:text-red-400 flex items-center space-x-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Hapus Temp Image</span>
                    </button>
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
