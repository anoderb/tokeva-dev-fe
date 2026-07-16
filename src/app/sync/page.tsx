"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Cloud,
  CheckCircle,
  Clock,
  Play,
  RotateCcw,
  Layers,
  Activity,
  Calendar,
  Settings,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import { supabase, PhotoHf, DatasetHf } from '../../lib/supabase';
import { syncDatasetToHF } from '../../lib/upload';
import { HF_REPO_ID } from '../../lib/config';

interface SyncLog {
  id: string;
  commitTitle: string;
  filesCount: number;
  timestamp: string;
  status: 'success' | 'failed';
}

interface PendingGroup {
  datasetId: string;
  datasetName: string;
  datasetSlug: string;
  count: number;
}

export default function SyncPage() {
  const router = useRouter();
  const [loading, setLoading] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);
  
  // Real dynamic states
  const [pendingPhotos, setPendingPhotos] = useState<PhotoHf[]>([]);
  const [pendingGroups, setPendingGroups] = useState<PendingGroup[]>([]);
  const [totalPending, setTotalPending] = useState<number>(0);
  
  const [syncProgress, setSyncProgress] = useState({
    percent: 0,
    statusText: ''
  });

  const [logs, setLogs] = useState<SyncLog[]>([]);

  // Load logs from localStorage on mount
  useEffect(() => {
    const savedLogs = localStorage.getItem('tokiva_sync_logs');
    if (savedLogs) {
      try {
        setLogs(JSON.parse(savedLogs));
      } catch (e) {
        console.error('Failed to parse sync logs:', e);
      }
    }
  }, []);

  // Fetch pending photos from Supabase
  const fetchPendingData = async () => {
    try {
      setLoading(true);
      // Fetch photos where storage_provider is supabase
      const { data: photos, error: photoErr } = await supabase
        .from('photos_hf')
        .select(`
          *,
          dataset:datasets_hf(id, name, slug)
        `)
        .eq('storage_provider', 'supabase');

      if (photoErr) throw photoErr;

      const photoList = (photos || []) as unknown as (PhotoHf & { dataset: DatasetHf })[];
      setPendingPhotos(photoList);
      setTotalPending(photoList.length);

      // Group by dataset
      const groupsMap = new Map<string, PendingGroup>();
      photoList.forEach(photo => {
        if (photo.dataset) {
          const key = photo.dataset.id;
          if (!groupsMap.has(key)) {
            groupsMap.set(key, {
              datasetId: photo.dataset.id,
              datasetName: photo.dataset.name,
              datasetSlug: photo.dataset.slug,
              count: 0
            });
          }
          groupsMap.get(key)!.count += 1;
        }
      });

      setPendingGroups(Array.from(groupsMap.values()));
    } catch (err) {
      console.error('Failed to fetch pending sync photos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingData();
  }, []);

  const handleStartSync = async () => {
    if (pendingGroups.length === 0) return;
    
    setSyncing(true);
    setSyncProgress({ percent: 0, statusText: 'Memulai sinkronisasi...' });
    
    let totalSynced = 0;
    const errors: string[] = [];

    try {
      // Loop and sync each dataset group sequentially
      for (let index = 0; index < pendingGroups.length; index++) {
        const group = pendingGroups[index];
        setSyncProgress({
          percent: Math.round((index / pendingGroups.length) * 100),
          statusText: `Sinkronisasi dataset: ${group.datasetName}...`
        });

        try {
          const result = await syncDatasetToHF(group.datasetId, group.datasetSlug, (current, total, statusText) => {
            const stepPercent = Math.round((current / total) * 100);
            const overallPercent = Math.round(
              ((index + (current / total)) / pendingGroups.length) * 100
            );
            setSyncProgress({
              percent: Math.min(overallPercent, 99),
              statusText: `[${group.datasetName}] ${statusText}`
            });
          });
          
          totalSynced += result.syncedCount;
        } catch (groupErr: any) {
          console.error(`Gagal sinkronisasi group ${group.datasetName}:`, groupErr);
          errors.push(`${group.datasetName}: ${groupErr.message}`);
        }
      }

      // Finalize progress
      setSyncProgress({ percent: 100, statusText: 'Sinkronisasi selesai!' });
      
      // Add log
      const newLog: SyncLog = {
        id: `log-${Date.now()}`,
        commitTitle: errors.length > 0 
          ? `Sinkronisasi sebagian (${totalSynced} foto berhasil, ${errors.length} gagal)`
          : `Sinkronisasi batch (${totalSynced} foto berhasil)`,
        filesCount: totalSynced,
        timestamp: new Date().toLocaleString('id-ID', { hour12: false }) + ' WIB',
        status: errors.length === pendingGroups.length ? 'failed' : 'success'
      };

      const updatedLogs = [newLog, ...logs];
      setLogs(updatedLogs);
      localStorage.setItem('tokiva_sync_logs', JSON.stringify(updatedLogs));

      if (errors.length > 0) {
        alert(`Sinkronisasi selesai dengan beberapa error:\n\n${errors.join('\n')}`);
      } else {
        alert(`Berhasil menyinkronkan ${totalSynced} foto ke Hugging Face!`);
      }
      
      // Refresh pending data
      await fetchPendingData();
    } catch (e: any) {
      console.error('General sync error:', e);
      alert(`Gagal menjalankan sinkronisasi: ${e.message}`);
    } finally {
      setSyncing(false);
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
              <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Hugging Face Sync</h1>
              <p className="text-xs text-slate-500 mt-1">Sinkronisasikan dataset dari Supabase Temporary Buffer ke Hugging Face Dataset Repository</p>
            </div>
          </div>

          <div className="flex items-center space-x-2 bg-slate-900/40 border border-slate-900 rounded-xl px-4 py-2 text-xs font-semibold text-slate-400">
            <Cloud className="w-4 h-4 text-blue-400" />
            <span>Connected</span>
          </div>
        </div>

        {/* Sync Controls & Info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Status info card */}
          <div className="p-6 rounded-2xl bg-slate-900/20 border border-slate-900 space-y-4 md:col-span-2">
            <h3 className="font-bold text-slate-200 text-sm">Status Sinkronisasi Saat Ini</h3>
            
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <span className="text-slate-500 font-bold uppercase tracking-wider text-[9px]">Repository Tujuan</span>
                <p className="text-slate-200 font-semibold truncate">datasets/{HF_REPO_ID || 'Anoderb/dataset-collect'}</p>
              </div>

              <div className="space-y-1">
                <span className="text-slate-500 font-bold uppercase tracking-wider text-[9px]">Unsynced Buffer Files</span>
                {loading ? (
                  <p className="text-slate-400 font-semibold flex items-center">
                    <RefreshCw className="w-3.5 h-3.5 mr-1 animate-spin" />
                    <span>Memuat...</span>
                  </p>
                ) : (
                  <p className={`${totalPending > 0 ? 'text-amber-500' : 'text-emerald-500'} font-semibold flex items-center`}>
                    <Clock className="w-3.5 h-3.5 mr-1" />
                    <span>{totalPending} foto pending</span>
                  </p>
                )}
              </div>
            </div>

            {/* List of Pending Groups */}
            {pendingGroups.length > 0 && !syncing && (
              <div className="mt-4 pt-4 border-t border-slate-900/50 space-y-2">
                <span className="text-slate-500 font-bold uppercase tracking-wider text-[9px]">Detail Buffer Per Produk</span>
                <div className="grid grid-cols-1 gap-2 max-h-36 overflow-y-auto pr-2">
                  {pendingGroups.map(group => (
                    <div key={group.datasetId} className="flex justify-between items-center bg-slate-900/40 px-3 py-1.5 rounded-lg text-xs">
                      <span className="text-slate-300 font-semibold">{group.datasetName}</span>
                      <span className="text-amber-500 font-bold font-mono">{group.count} foto</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {syncing ? (
              <div className="space-y-3 pt-4 border-t border-slate-900/50">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 truncate max-w-[80%]">{syncProgress.statusText}</span>
                  <span className="font-bold text-blue-400">{syncProgress.percent}%</span>
                </div>
                <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-850">
                  <div className="bg-blue-500 h-full transition-all duration-300" style={{ width: `${syncProgress.percent}%` }} />
                </div>
              </div>
            ) : (
              <div className="pt-4 border-t border-slate-900/50 flex space-x-3">
                <button
                  onClick={handleStartSync}
                  disabled={totalPending === 0}
                  className={`px-4 py-2 font-bold rounded-xl text-xs flex items-center space-x-1.5 transition-colors shadow-lg active:scale-95 ${
                    totalPending > 0
                      ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/10 hover:shadow-blue-500/20'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed shadow-none'
                  }`}
                >
                  <Play className="w-4 h-4" />
                  <span>Mulai Sinkronisasi Sekarang</span>
                </button>

                <button
                  onClick={fetchPendingData}
                  disabled={loading}
                  className="p-2 bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-slate-200 rounded-xl transition-colors border border-slate-850"
                  title="Segarkan data"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            )}
          </div>

          {/* Sync Rules */}
          <div className="p-6 rounded-2xl bg-slate-900/20 border border-slate-900 space-y-4">
            <h3 className="font-bold text-slate-200 text-sm flex items-center space-x-1">
              <Settings className="w-4 h-4 text-slate-500" />
              <span>Pengaturan Sync</span>
            </h3>
            
            <div className="space-y-3 text-xs text-slate-400 leading-relaxed">
              <div className="flex items-center justify-between">
                <span>Auto-sync threshold:</span>
                <span className="text-slate-200 font-semibold">2,000 foto</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Clean after sync:</span>
                <span className="text-slate-200 font-semibold">Enabled</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-2">
                *File Supabase Storage otomatis dihapus setelah commit di Hugging Face sukses untuk menghemat kuota free-tier Supabase.
              </p>
            </div>
          </div>

        </div>

        {/* Sync logs history */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-slate-200 text-sm">Log Riwayat Sinkronisasi</h3>
            {logs.length > 0 && (
              <button
                onClick={() => {
                  if (confirm('Bersihkan semua riwayat log?')) {
                    setLogs([]);
                    localStorage.removeItem('tokiva_sync_logs');
                  }
                }}
                className="text-[10px] text-slate-500 hover:text-slate-400 hover:underline"
              >
                Clear History
              </button>
            )}
          </div>
          
          <div className="space-y-3">
            {logs.length === 0 ? (
              <div className="p-8 rounded-xl border border-dashed border-slate-900 text-center text-xs text-slate-500">
                <CheckCircle className="w-6 h-6 mx-auto mb-2 text-slate-650" />
                <span>Belum ada riwayat sinkronisasi di browser ini.</span>
              </div>
            ) : (
              logs.map((log) => (
                <div
                  key={log.id}
                  className="p-4 rounded-xl bg-slate-900/10 border border-slate-900 hover:border-slate-850 transition-colors flex items-center justify-between text-xs"
                >
                  <div className="space-y-1">
                    <span className="font-semibold text-slate-200">{log.commitTitle}</span>
                    <p className="text-[10px] text-slate-500 flex items-center space-x-1">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{log.timestamp}</span>
                    </p>
                  </div>

                  <div className="text-right space-y-1">
                    <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${
                      log.status === 'success'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}>
                      {log.status === 'success' ? 'Success' : 'Failed'}
                    </span>
                    <p className="text-[10px] text-slate-500 font-mono">{log.filesCount} files</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
