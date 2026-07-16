"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Cpu,
  Upload,
  Layers,
  Activity,
  Calendar,
  CheckCircle,
  FileCode,
  HardDrive
} from 'lucide-react';

interface ModelVersion {
  version: string;
  accuracy: number;
  classesCount: number;
  fileSize: string;
  createdAt: string;
  isActive: boolean;
  notes: string;
}

export default function ModelPage() {
  const router = useRouter();
  const [models, setModels] = useState<ModelVersion[]>([
    {
      version: "v1.2-stable",
      accuracy: 94.6,
      classesCount: 42,
      fileSize: "8.4 MB",
      createdAt: "15 Jul 2026",
      isActive: true,
      notes: "Fine-tuning MobileNetV4 dengan penambahan data bumbu dapur dan mi instan."
    },
    {
      version: "v1.1-release",
      accuracy: 91.2,
      classesCount: 38,
      fileSize: "8.2 MB",
      createdAt: "02 Jul 2026",
      isActive: false,
      notes: "Release pertama dengan klasifikasi sembako dasar."
    },
    {
      version: "v1.0-alpha",
      accuracy: 84.5,
      classesCount: 20,
      fileSize: "7.9 MB",
      createdAt: "18 Jun 2026",
      isActive: false,
      notes: "Baseline model untuk testing web PWA."
    }
  ]);

  const handleSetActive = (version: string) => {
    setModels(prev =>
      prev.map(m => ({
        ...m,
        isActive: m.version === version
      }))
    );
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
              <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Model AI Manager</h1>
              <p className="text-xs text-slate-500 mt-1">Kelola versi, akurasi, dan deployment model TensorFlow.js</p>
            </div>
          </div>
        </div>

        {/* Deploy & Metrics Summary */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-900 flex items-center space-x-4">
            <div className="p-3 bg-blue-600/10 text-blue-400 rounded-xl">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Model Aktif</span>
              <p className="font-semibold text-slate-200 text-sm">{models.find(m => m.isActive)?.version}</p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-900 flex items-center space-x-4">
            <div className="p-3 bg-indigo-600/10 text-indigo-400 rounded-xl">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Akurasi Model</span>
              <p className="font-semibold text-slate-200 text-sm">{models.find(m => m.isActive)?.accuracy}%</p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-900 flex items-center space-x-4">
            <div className="p-3 bg-emerald-600/10 text-emerald-400 rounded-xl">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Jumlah Kelas</span>
              <p className="font-semibold text-slate-200 text-sm">{models.find(m => m.isActive)?.classesCount} Produk</p>
            </div>
          </div>
        </section>

        {/* Main Grid: Upload Model + List Versions */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
          
          {/* Upload Form */}
          <div className="md:col-span-2 space-y-4">
            <div className="p-5 rounded-2xl bg-slate-900/20 border border-slate-900 space-y-4">
              <h3 className="font-bold text-slate-200 text-sm border-b border-slate-900 pb-2">Unggah Model Baru</h3>
              
              <div className="space-y-4">
                {/* file.json */}
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Model JSON Config</label>
                  <label className="flex items-center justify-center border border-dashed border-slate-800 hover:border-slate-700 bg-slate-950/20 rounded-xl py-4 cursor-pointer text-xs text-slate-400 space-x-2">
                    <FileCode className="w-4 h-4 text-slate-500" />
                    <span>Pilih model.json</span>
                    <input type="file" accept=".json" className="hidden" />
                  </label>
                </div>

                {/* weights.bin */}
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Weights File (.bin)</label>
                  <label className="flex items-center justify-center border border-dashed border-slate-800 hover:border-slate-700 bg-slate-950/20 rounded-xl py-4 cursor-pointer text-xs text-slate-400 space-x-2">
                    <HardDrive className="w-4 h-4 text-slate-500" />
                    <span>Pilih model.weights.bin</span>
                    <input type="file" accept=".bin" className="hidden" />
                  </label>
                </div>

                {/* version name */}
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Nama Versi</label>
                  <input
                    type="text"
                    placeholder="Contoh: v1.3-release"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-slate-700 rounded-xl text-xs"
                  />
                </div>

                <button className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs transition-colors flex items-center justify-center space-x-2">
                  <Upload className="w-4 h-4" />
                  <span>Mulai Unggah</span>
                </button>
              </div>
            </div>
          </div>

          {/* Versions List */}
          <div className="md:col-span-3 space-y-4">
            <h3 className="font-bold text-slate-200 text-sm">Riwayat Versi Model</h3>
            
            <div className="space-y-4">
              {models.map((model) => (
                <div
                  key={model.version}
                  className={`p-5 rounded-2xl border transition-all ${
                    model.isActive
                      ? 'bg-blue-600/5 border-blue-500/30'
                      : 'bg-slate-900/20 border-slate-900'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-100 text-sm">{model.version}</span>
                        {model.isActive && (
                          <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 text-[9px] font-bold rounded-full border border-blue-500/20">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-slate-400 text-xs leading-relaxed">{model.notes}</p>
                    </div>

                    <div className="text-right space-y-1">
                      <span className="text-xs text-blue-400 font-bold">{model.accuracy}% Acc</span>
                      <p className="text-[10px] text-slate-500 flex items-center justify-end space-x-1">
                        <Calendar className="w-3 h-3" />
                        <span>{model.createdAt}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-900/50 text-[10px] text-slate-500">
                    <span>Ukuran: {model.fileSize} • {model.classesCount} kelas terintegrasi</span>
                    {!model.isActive && (
                      <button
                        onClick={() => handleSetActive(model.version)}
                        className="px-3 py-1 bg-slate-800 hover:bg-slate-700 hover:text-slate-200 rounded-lg text-[10px] transition-colors"
                      >
                        Aktifkan Versi Ini
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
