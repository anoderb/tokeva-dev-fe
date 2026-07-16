"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase, getDatasets, getPhotos } from '../lib/supabase';
import { HF_REPO } from '../lib/config';
import {
  Layers,
  Database,
  Cloud,
  CheckCircle,
  Clock,
  ArrowRight,
  TrendingUp,
  Cpu,
  Sliders,
  ShieldCheck,
  RefreshCw,
  FolderOpen,
  Camera
} from 'lucide-react';

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalPhotos: 0,
    syncedPhotos: 0,
    pendingSync: 0,
    totalDatasets: 0
  });
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadStats() {
      try {
        setLoading(true);
        // Get datasets count
        const { count: datasetsCount, error: dcErr } = await supabase
          .from('datasets_hf')
          .select('*', { count: 'exact', head: true });
        
        // Get total photos count
        const { count: photosCount, error: pErr } = await supabase
          .from('photos_hf')
          .select('*', { count: 'exact', head: true });

        // Get synced photos count (Hugging Face)
        const { count: syncedCount } = await supabase
          .from('photos_hf')
          .select('*', { count: 'exact', head: true })
          .eq('storage_provider', 'huggingface');

        // Get unsynced photos count (Supabase buffer)
        const { count: pendingCount } = await supabase
          .from('photos_hf')
          .select('*', { count: 'exact', head: true })
          .eq('storage_provider', 'supabase');

        setStats({
          totalProducts: datasetsCount || 0, // In this model datasets_hf maps to labels/products
          totalPhotos: photosCount || 0,
          syncedPhotos: syncedCount || 0,
          pendingSync: pendingCount || 0,
          totalDatasets: datasetsCount || 0
        });
      } catch (err) {
        console.error("Gagal memuat statistik dashboard:", err);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 flex flex-col justify-start items-center">
      {/* Container wrapper */}
      <div className="w-full max-w-6xl space-y-10">
        
        {/* Header Section */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-900 pb-8">
          <div>
            <div className="flex items-center space-x-2">
              <Cpu className="w-6 h-6 text-blue-500" />
              <span className="font-bold text-slate-200 tracking-wider uppercase text-xs">TOKIVA AI Platform</span>
            </div>
            <h1 className="text-3xl font-extrabold text-slate-100 tracking-tight mt-2">Dashboard Pengembang</h1>
            <p className="text-sm text-slate-400 mt-1 leading-relaxed">
              Pusat monitoring dataset, versioning model, dan feedback MLOps POS Tokiva.
            </p>
          </div>

          <div className="flex items-center space-x-3 bg-slate-900/40 border border-slate-900 rounded-xl px-4 py-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-semibold text-slate-300">Supabase Connected</span>
          </div>
        </header>

        {/* Loading Spinner */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-500">
            <RefreshCw className="w-10 h-10 animate-spin mb-4 text-blue-500" />
            <span className="text-xs">Memuat informasi MLOps...</span>
          </div>
        ) : (
          <>
            {/* Stats Metrics Grid */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Card 1 */}
              <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-900/70 hover:border-slate-800 transition-all flex items-start justify-between">
                <div className="space-y-2">
                  <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Master Produk AI</span>
                  <h3 className="text-3xl font-extrabold text-slate-100">{stats.totalProducts}</h3>
                  <p className="text-[10px] text-slate-500">Kelas produk terdaftar</p>
                </div>
                <div className="p-3 bg-blue-600/10 rounded-xl text-blue-400">
                  <Database className="w-5 h-5" />
                </div>
              </div>

              {/* Card 2 */}
              <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-900/70 hover:border-slate-800 transition-all flex items-start justify-between">
                <div className="space-y-2">
                  <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Total Dataset</span>
                  <h3 className="text-3xl font-extrabold text-slate-100">{stats.totalPhotos}</h3>
                  <p className="text-[10px] text-slate-500">Foto & Frame terkumpul</p>
                </div>
                <div className="p-3 bg-indigo-600/10 rounded-xl text-indigo-400">
                  <Layers className="w-5 h-5" />
                </div>
              </div>

              {/* Card 3 */}
              <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-900/70 hover:border-slate-800 transition-all flex items-start justify-between">
                <div className="space-y-2">
                  <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Hugging Face Sync</span>
                  <h3 className="text-3xl font-extrabold text-slate-100">{stats.syncedPhotos}</h3>
                  <p className="text-[10px] text-emerald-500 font-semibold flex items-center space-x-1">
                    <CheckCircle className="w-3 h-3 mr-0.5" />
                    <span>Tersinkronisasi</span>
                  </p>
                </div>
                <div className="p-3 bg-emerald-600/10 rounded-xl text-emerald-400">
                  <Cloud className="w-5 h-5" />
                </div>
              </div>

              {/* Card 4 */}
              <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-900/70 hover:border-slate-800 transition-all flex items-start justify-between">
                <div className="space-y-2">
                  <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Temporary Buffer</span>
                  <h3 className="text-3xl font-extrabold text-slate-100">{stats.pendingSync}</h3>
                  <p className="text-[10px] text-amber-500 font-semibold flex items-center space-x-1">
                    <Clock className="w-3 h-3 mr-0.5" />
                    <span>Di Supabase Storage</span>
                  </p>
                </div>
                <div className="p-3 bg-amber-600/10 rounded-xl text-amber-400">
                  <Clock className="w-5 h-5" />
                </div>
              </div>
            </section>

            {/* Quick Actions & Navigation Link Cards */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Card A: Master Produk AI */}
              <div className="p-6 rounded-2xl bg-slate-900/20 border border-slate-900 flex flex-col justify-between h-[180px] hover:border-slate-800 transition-all group">
                <div className="space-y-2">
                  <div className="flex items-center space-x-2 text-blue-400">
                    <Database className="w-5 h-5" />
                    <h4 className="font-bold text-slate-200 text-sm">Master Produk AI</h4>
                  </div>
                  <p className="text-slate-400 text-xs leading-relaxed">
                    Kelola label/SKU produk utama yang akan dikenali oleh model AI Scanner kasir.
                  </p>
                </div>
                <Link
                  href="/master-produk"
                  className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center space-x-1 self-start group-hover:translate-x-1 transition-transform"
                >
                  <span>Buka Master DB</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>

              {/* Card B: Dataset Management */}
              <div className="p-6 rounded-2xl bg-slate-900/20 border border-slate-900 flex flex-col justify-between h-[180px] hover:border-slate-800 transition-all group">
                <div className="space-y-2">
                  <div className="flex items-center space-x-2 text-indigo-400">
                    <FolderOpen className="w-5 h-5" />
                    <h4 className="font-bold text-slate-200 text-sm">Dataset Manager</h4>
                  </div>
                  <p className="text-slate-400 text-xs leading-relaxed">
                    Lihat detail dataset per produk, review kualitas foto, dan ekspor zip.
                  </p>
                </div>
                <Link
                  href="/dataset"
                  className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center space-x-1 self-start group-hover:translate-x-1 transition-transform"
                >
                  <span>Lihat Folder Dataset</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>

              {/* Card C: Camera Collect System */}
              <div className="p-6 rounded-2xl bg-slate-900/20 border border-slate-900 flex flex-col justify-between h-[180px] hover:border-slate-800 transition-all group">
                <div className="space-y-2">
                  <div className="flex items-center space-x-2 text-emerald-400">
                    <Camera className="w-5 h-5" />
                    <h4 className="font-bold text-slate-200 text-sm">Camera Collector</h4>
                  </div>
                  <p className="text-slate-400 text-xs leading-relaxed">
                    Ambil dataset secara instan menggunakan kamera (Burst, Interval, Video Seeking).
                  </p>
                </div>
                <Link
                  href="/dataset" // Redirects to dataset manager so user can select which product to collect for
                  className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center space-x-1 self-start group-hover:translate-x-1 transition-transform"
                >
                  <span>Mulai Mengumpulkan</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>

            </section>

            {/* HuggingFace Sync Info Panel */}
            <section className="p-6 rounded-2xl bg-slate-900/20 border border-slate-900/70 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-900 pb-3">
                <h4 className="font-bold text-slate-200 text-sm flex items-center space-x-2">
                  <Cloud className="w-5 h-5 text-indigo-400" />
                  <span>Informasi Hugging Face Hub</span>
                </h4>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-slate-800 text-slate-400 rounded">
                  Main Branch
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="space-y-1">
                  <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">Dataset Repository</span>
                  <p className="text-slate-300 font-semibold">{HF_REPO || 'Belum Dikonfigurasi'}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">Auto-Sync Status</span>
                  <p className="text-slate-300 font-semibold">Treshold: 2,000 foto (Supabase Buffer)</p>
                </div>
              </div>
            </section>
          </>
        )}

      </div>
    </main>
  );
}
