"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Check,
  X,
  AlertTriangle,
  Clock,
  Eye,
  RefreshCw,
  MessageSquare
} from 'lucide-react';

interface FeedbackItem {
  id: string;
  imgUrl: string;
  predictedLabel: string;
  confidence: number;
  actualLabel: string;
  model: string;
  timestamp: string;
  cashierName: string;
}

export default function FeedbackPage() {
  const router = useRouter();
  const [feedbackQueue, setFeedbackQueue] = useState<FeedbackItem[]>([
    {
      id: "fb-001",
      imgUrl: "https://mkfokoifzniofquqbwsi.supabase.co/storage/v1/object/public/dataset-photos/indomie-goreng/indomie-goreng_x8y2z_001.jpg",
      predictedLabel: "Indomie Ayam Bawang",
      confidence: 68.5,
      actualLabel: "Indomie Goreng",
      model: "v1.2-stable",
      timestamp: "17 Jul 2026, 12:45 WIB",
      cashierName: "Budi (Shift Pagi)"
    },
    {
      id: "fb-002",
      imgUrl: "https://mkfokoifzniofquqbwsi.supabase.co/storage/v1/object/public/dataset-photos/susu-uht-ultra/susu-uht-ultra_preview.jpg",
      predictedLabel: "Sari Roti Tawar",
      confidence: 52.1,
      actualLabel: "Susu UHT Ultra",
      model: "v1.2-stable",
      timestamp: "17 Jul 2026, 10:15 WIB",
      cashierName: "Ani (Shift Pagi)"
    }
  ]);

  const handleApprove = (id: string) => {
    setFeedbackQueue(prev => prev.filter(item => item.id !== id));
    alert("Feedback disetujui! Ditambahkan ke Official Training Dataset.");
  };

  const handleReject = (id: string) => {
    setFeedbackQueue(prev => prev.filter(item => item.id !== id));
    alert("Feedback ditolak & dibuang.");
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
              <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Feedback AI Review Queue</h1>
              <p className="text-xs text-slate-500 mt-1">Review dan validasi kesalahan prediksi model yang dilaporkan kasir</p>
            </div>
          </div>

          <div className="flex items-center space-x-2 bg-slate-900/40 border border-slate-900 rounded-xl px-4 py-2 text-xs font-semibold text-slate-400">
            <MessageSquare className="w-4 h-4 text-blue-500" />
            <span>{feedbackQueue.length} Pending Review</span>
          </div>
        </div>

        {/* Content */}
        {feedbackQueue.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500 text-center bg-slate-900/10 border border-slate-900 rounded-2xl">
            <Clock className="w-10 h-10 mb-3 opacity-30 text-emerald-400" />
            <p className="text-sm font-semibold text-slate-400">Antrean Bersih!</p>
            <p className="text-xs mt-1">Tidak ada laporan kesalahan prediksi yang pending untuk ditinjau.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {feedbackQueue.map((item) => (
              <div
                key={item.id}
                className="p-5 rounded-2xl bg-slate-900/20 border border-slate-900 flex flex-col md:flex-row gap-6 hover:border-slate-850 transition-all"
              >
                {/* Captured Image */}
                <div className="w-full md:w-44 aspect-square rounded-xl overflow-hidden bg-slate-950 border border-slate-850 relative group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.imgUrl} alt="feedback preview" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <a href={item.imgUrl} target="_blank" rel="noreferrer" className="p-2 bg-slate-800 text-slate-200 hover:bg-slate-700 rounded-lg text-xs font-semibold flex items-center space-x-1">
                      <Eye className="w-3.5 h-3.5" />
                      <span>Lihat Asli</span>
                    </a>
                  </div>
                </div>

                {/* Metadata details */}
                <div className="flex-1 flex flex-col justify-between py-1 space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div className="space-y-1">
                      <span className="text-slate-500 font-bold uppercase tracking-wider text-[9px]">Prediksi Model (Wrong)</span>
                      <p className="text-red-400 font-semibold flex items-center">
                        <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                        <span>{item.predictedLabel} ({item.confidence}%)</span>
                      </p>
                    </div>

                    <div className="space-y-1">
                      <span className="text-slate-500 font-bold uppercase tracking-wider text-[9px]">Label Kasir (Actual)</span>
                      <p className="text-emerald-400 font-bold flex items-center">
                        <Check className="w-3.5 h-3.5 mr-1" />
                        <span>{item.actualLabel}</span>
                      </p>
                    </div>

                    <div className="space-y-1">
                      <span className="text-slate-500 font-bold uppercase tracking-wider text-[9px]">Pengirim / Waktu</span>
                      <p className="text-slate-350">{item.cashierName}</p>
                      <p className="text-slate-500 text-[10px]">{item.timestamp}</p>
                    </div>

                    <div className="space-y-1">
                      <span className="text-slate-500 font-bold uppercase tracking-wider text-[9px]">Model Version</span>
                      <p className="text-slate-350">{item.model}</p>
                    </div>
                  </div>

                  {/* Actions buttons */}
                  <div className="flex space-x-3 border-t border-slate-900/60 pt-4">
                    <button
                      onClick={() => handleApprove(item.id)}
                      className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center justify-center space-x-2 transition-colors"
                    >
                      <Check className="w-4 h-4" />
                      <span>Validasi & Tambah Dataset</span>
                    </button>
                    <button
                      onClick={() => handleReject(item.id)}
                      className="flex-1 py-2 border border-slate-800 hover:bg-slate-900 text-slate-400 hover:text-slate-200 text-xs font-semibold rounded-xl flex items-center justify-center space-x-2 transition-colors"
                    >
                      <X className="w-4 h-4" />
                      <span>Tolak & Hapus</span>
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
