"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Settings,
  Cloud,
  Eye,
  Sliders,
  ShieldCheck,
  Save,
  Lock,
  ShieldAlert
} from 'lucide-react';

export default function PengaturanPage() {
  const router = useRouter();
  const [hfConfig, setHfConfig] = useState({
    repo: "Anoderb/dataset-collect",
    token: ""
  });

  const [thresholds, setThresholds] = useState({
    minConfidence: 90,
    mediumConfidence: 60,
    blurVariance: 5.0,
    minBrightness: 45
  });

  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
    }, 3000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 flex flex-col justify-start items-center">
      <div className="w-full max-w-3xl space-y-8">
        
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
              <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Pengaturan AI</h1>
              <p className="text-xs text-slate-500 mt-1">Konfigurasi parameter MLOps, ambang batas kualitas, dan kredensial API</p>
            </div>
          </div>
        </div>

        {/* Form Settings */}
        <form onSubmit={handleSave} className="space-y-6">
          
          {/* Section 1: HF Creds */}
          <div className="p-6 rounded-2xl bg-slate-900/20 border border-slate-900 space-y-4">
            <h3 className="font-bold text-slate-200 text-sm flex items-center space-x-2 border-b border-slate-900 pb-3">
              <Cloud className="w-4.5 h-4.5 text-blue-400" />
              <span>Hugging Face Hub Integration</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Repository Name</label>
                <input
                  type="text"
                  value={hfConfig.repo}
                  onChange={(e) => setHfConfig({ ...hfConfig, repo: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-850 focus:border-slate-800 rounded-xl text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Write Token (Secret)</label>
                <div className="relative">
                  <input
                    type="password"
                    value={hfConfig.token}
                    onChange={(e) => setHfConfig({ ...hfConfig, token: e.target.value })}
                    className="w-full pl-3.5 pr-10 py-2 bg-slate-950 border border-slate-850 focus:border-slate-800 rounded-xl text-xs"
                  />
                  <Lock className="w-4 h-4 text-slate-500 absolute right-3 top-2.5" />
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Model Thresholds */}
          <div className="p-6 rounded-2xl bg-slate-900/20 border border-slate-900 space-y-4">
            <h3 className="font-bold text-slate-200 text-sm flex items-center space-x-2 border-b border-slate-900 pb-3">
              <Sliders className="w-4.5 h-4.5 text-indigo-400" />
              <span>Confidence Thresholds (Scanner POS)</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Min. Confidence (High)</label>
                <input
                  type="number"
                  value={thresholds.minConfidence}
                  onChange={(e) => setThresholds({ ...thresholds, minConfidence: Number(e.target.value) })}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-850 focus:border-slate-800 rounded-xl text-xs"
                />
                <span className="text-[10px] text-slate-500">Di atas persentase ini produk langsung masuk keranjang POS</span>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Medium Confidence Fallback</label>
                <input
                  type="number"
                  value={thresholds.mediumConfidence}
                  onChange={(e) => setThresholds({ ...thresholds, mediumConfidence: Number(e.target.value) })}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-850 focus:border-slate-800 rounded-xl text-xs"
                />
                <span className="text-[10px] text-slate-500">Di bawah persentase ini sistem menampilkan multi-prediksi ke kasir</span>
              </div>
            </div>
          </div>

          {/* Section 3: Image Quality Thresholds */}
          <div className="p-6 rounded-2xl bg-slate-900/20 border border-slate-900 space-y-4">
            <h3 className="font-bold text-slate-200 text-sm flex items-center space-x-2 border-b border-slate-900 pb-3">
              <ShieldAlert className="w-4.5 h-4.5 text-amber-500" />
              <span>Ambang Batas Kualitas Gambar (Collector)</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Min. Blur Variance</label>
                <input
                  type="number"
                  step="0.1"
                  value={thresholds.blurVariance}
                  onChange={(e) => setThresholds({ ...thresholds, blurVariance: Number(e.target.value) })}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-850 focus:border-slate-800 rounded-xl text-xs"
                />
                <span className="text-[10px] text-slate-500">Nilai varians Laplacian terendah untuk mendeteksi frame blur</span>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Min. Brightness Value</label>
                <input
                  type="number"
                  value={thresholds.minBrightness}
                  onChange={(e) => setThresholds({ ...thresholds, minBrightness: Number(e.target.value) })}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-850 focus:border-slate-800 rounded-xl text-xs"
                />
                <span className="text-[10px] text-slate-500">Batas terbawah kecerahan rata-rata piksel (0 - 255)</span>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-900">
            {saveSuccess ? (
              <span className="text-emerald-400 text-xs font-semibold flex items-center animate-bounce">
                <ShieldCheck className="w-4 h-4 mr-1.5" />
                <span>Pengaturan berhasil disimpan!</span>
              </span>
            ) : <div />}

            <button
              type="submit"
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs flex items-center space-x-2 transition-all shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20 active:scale-95"
            >
              <Save className="w-4 h-4" />
              <span>Simpan Konfigurasi</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
