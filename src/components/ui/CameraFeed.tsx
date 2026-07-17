"use client";

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useCamera, FacingMode } from '../../hooks/useCamera';
import { Camera, RefreshCw, X, Video, Play, Square, Pause } from 'lucide-react';

interface CameraFeedProps {
  onCapture: (blob: Blob) => void;
  onClose: () => void;
  onVideoRecorded?: (videoBlob: Blob) => void;
  title?: string;
  isActive: boolean;
}

export default function CameraFeed({
  onCapture,
  onClose,
  onVideoRecorded,
  title = "Kamera Dataset AI",
  isActive
}: CameraFeedProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const {
    stream,
    facingMode,
    isCameraActive,
    error,
    startCamera,
    stopCamera,
    switchCamera,
    captureFrameBlob,
    recorderState,
    recorderStats,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    cancelRecording
  } = useCamera();

  // Auto Capture states
  const [autoCaptureInterval, setAutoCaptureInterval] = useState<number>(1000);
  const [isAutoCapturing, setIsAutoCapturing] = useState<boolean>(false);
  const [autoCapturedCount, setAutoCapturedCount] = useState<number>(0);
  const [autoCaptureElapsedTime, setAutoCaptureElapsedTime] = useState<number>(0);

  // Burst states
  const [burstCount, setBurstCount] = useState<number>(3);
  const [isBurstCapturing, setIsBurstCapturing] = useState<boolean>(false);

  // Refs for auto capture loops
  const autoCaptureTimerRef = useRef<NodeJS.Timeout | null>(null);
  const autoCaptureElapsedTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isAutoCapturingRef = useRef<boolean>(false);

  // Stop auto capture helper
  const stopAutoCapture = useCallback(() => {
    isAutoCapturingRef.current = false;
    setIsAutoCapturing(false);
    if (autoCaptureTimerRef.current) {
      clearTimeout(autoCaptureTimerRef.current);
      autoCaptureTimerRef.current = null;
    }
    if (autoCaptureElapsedTimerRef.current) {
      clearInterval(autoCaptureElapsedTimerRef.current);
      autoCaptureElapsedTimerRef.current = null;
    }
  }, []);

  // Format seconds to MM:SS or HH:MM:SS
  const formatTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return [
      h > 0 ? String(h).padStart(2, '0') : null,
      String(m).padStart(2, '0'),
      String(s).padStart(2, '0')
    ].filter(Boolean).join(':');
  };

  // Start auto capture
  const startAutoCapture = useCallback(() => {
    if (isAutoCapturingRef.current || !isCameraActive || !videoRef.current) return;

    isAutoCapturingRef.current = true;
    setIsAutoCapturing(true);
    setAutoCapturedCount(0);
    setAutoCaptureElapsedTime(0);

    const startTime = Date.now();

    // Elapsed timer
    autoCaptureElapsedTimerRef.current = setInterval(() => {
      setAutoCaptureElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    // Capture loop
    const captureLoop = async () => {
      if (!isAutoCapturingRef.current || !videoRef.current) return;

      try {
        const rawBlob = await captureFrameBlob(videoRef.current);
        onCapture(rawBlob);
        setAutoCapturedCount((prev) => prev + 1);

        // Flash effect
        if (videoRef.current) {
          videoRef.current.style.opacity = '0.3';
          setTimeout(() => {
            if (videoRef.current) videoRef.current.style.opacity = '1';
          }, 80);
        }
      } catch (err) {
        console.error("Gagal auto capture:", err);
      }

      if (isAutoCapturingRef.current) {
        autoCaptureTimerRef.current = setTimeout(captureLoop, autoCaptureInterval);
      }
    };

    // Run first capture instantly
    captureLoop();
  }, [isCameraActive, autoCaptureInterval, onCapture, captureFrameBlob]);

  const toggleAutoCapture = () => {
    if (isAutoCapturing) {
      stopAutoCapture();
    } else {
      startAutoCapture();
    }
  };

  // Burst capture handler
  const handleBurstCapture = async () => {
    if (isBurstCapturing || !isCameraActive || !videoRef.current) return;
    setIsBurstCapturing(true);

    try {
      for (let i = 0; i < burstCount; i++) {
        if (!videoRef.current) break;
        const rawBlob = await captureFrameBlob(videoRef.current);
        onCapture(rawBlob);

        // Shutter flash effect
        if (videoRef.current) {
          videoRef.current.style.opacity = '0.3';
          setTimeout(() => {
            if (videoRef.current) videoRef.current.style.opacity = '1';
          }, 55);
        }

        // Delay between burst captures (150ms)
        if (i < burstCount - 1) {
          await new Promise((resolve) => setTimeout(resolve, 150));
        }
      }
    } catch (err) {
      console.error("Gagal burst capture:", err);
    } finally {
      setIsBurstCapturing(false);
    }
  };

  // Handle camera start/stop on active state change
  // We only run this when isActive changes to avoid double-trigger or infinite loops
  useEffect(() => {
    if (isActive && videoRef.current) {
      startCamera(videoRef.current, facingMode).catch((err) => {
        console.error("Gagal menjalankan kamera:", err);
      });
    } else {
      stopCamera(videoRef.current);
      stopAutoCapture();
    }
    return () => {
      stopCamera(videoRef.current);
      stopAutoCapture();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  const handleCapture = async () => {
    if (!videoRef.current || !isCameraActive) return;
    try {
      // Flash visual effect
      if (videoRef.current) {
        videoRef.current.style.opacity = '0.3';
        setTimeout(() => {
          if (videoRef.current) videoRef.current.style.opacity = '1';
        }, 80);
      }
      const rawBlob = await captureFrameBlob(videoRef.current);
      onCapture(rawBlob);
    } catch (err) {
      console.error("Gagal menangkap frame:", err);
    }
  };

  const handleToggleCamera = () => {
    if (!videoRef.current) return;
    switchCamera(videoRef.current);
  };

  const handleStartRecording = () => {
    if (!stream) return;
    startRecording();
  };

  const handleStopRecording = async () => {
    try {
      const videoBlob = await stopRecording();
      if (onVideoRecorded) {
        onVideoRecorded(videoBlob);
      }
    } catch (err) {
      console.error("Gagal menghentikan rekaman video:", err);
    }
  };

  if (!isActive) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex flex-col bg-black transition-all duration-300">
      {/* Header */}
      <div className="absolute top-0 left-0 w-full z-50 flex items-center justify-between px-6 py-4 bg-gradient-to-b from-black/85 to-transparent">
        {/* Close Button */}
        <button
          onClick={() => {
            stopAutoCapture();
            cancelRecording();
            onClose();
          }}
          className="p-2.5 text-white bg-white/10 hover:bg-white/20 active:scale-95 rounded-full transition-colors flex items-center justify-center"
          title="Tutup Kamera"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title */}
        <div className="flex items-center space-x-2 text-white font-semibold text-sm sm:text-base drop-shadow-md">
          <span>📸</span>
          <span>{onVideoRecorded ? "Perekaman Video Dataset" : "Ambil Foto Dataset"}</span>
        </div>

        {/* Swap Camera Button */}
        <button
          onClick={handleToggleCamera}
          disabled={!isCameraActive || recorderState !== 'inactive' || isBurstCapturing}
          className="p-2.5 text-white bg-white/10 hover:bg-white/20 active:scale-95 disabled:opacity-30 disabled:hover:bg-white/10 rounded-full transition-colors flex items-center justify-center"
          title="Ganti Kamera"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Auto Capture HUD overlay (only in photo mode) */}
      {isAutoCapturing && !onVideoRecorded && (
        <div className="absolute top-[80px] left-1/2 -translate-x-1/2 bg-red-600/90 text-white rounded-xl px-4 py-2 flex items-center gap-3 shadow-lg shadow-red-600/30 z-[1005] text-sm font-semibold animate-pulse border border-red-500/30">
          <div className="w-2 h-2 rounded-full bg-white animate-ping" />
          <span>{autoCapturedCount} Foto</span>
          <span className="opacity-40">|</span>
          <span>{formatTime(autoCaptureElapsedTime)}</span>
          <button
            onClick={stopAutoCapture}
            className="ml-2 px-3 py-1 bg-white text-red-600 rounded-lg text-xs font-bold hover:bg-red-50 transition-colors"
          >
            Stop
          </button>
        </div>
      )}

      {/* Camera Viewport Area */}
      <div className="relative flex-1 w-full h-full bg-black overflow-hidden">
        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-20">
            <p className="text-red-400 font-medium mb-3">Akses Kamera Gagal</p>
            <p className="text-slate-450 text-sm max-w-xs">{error}</p>
            <button
              onClick={() => videoRef.current && startCamera(videoRef.current, facingMode)}
              className="mt-4 px-4 py-2 bg-slate-800 text-slate-200 rounded-lg hover:bg-slate-700 text-sm transition-colors"
            >
              Coba Lagi
            </button>
          </div>
        ) : (
          <>
            {/* Live feed */}
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
              autoPlay
            />

            {/* Viewport grid overlays */}
            <div className="absolute inset-0 grid grid-cols-3 pointer-events-none opacity-20 border border-slate-700">
              <div className="border-r border-slate-700 h-full" />
              <div className="border-r border-slate-700 h-full" />
            </div>
            <div className="absolute inset-0 grid grid-rows-3 pointer-events-none opacity-20">
              <div className="border-b border-slate-700 w-full" />
              <div className="border-b border-slate-700 w-full" />
            </div>

            {/* Video recording stats HUD */}
            {recorderState !== 'inactive' && (
              <div className="absolute top-20 left-4 flex items-center space-x-3 px-3 py-1.5 bg-red-600/90 text-white text-xs font-semibold rounded-full shadow-lg backdrop-blur-sm animate-pulse z-50">
                <div className="w-2 h-2 rounded-full bg-white animate-ping" />
                <span>REC</span>
                <span className="opacity-60">|</span>
                <span>{recorderStats.formattedTime}</span>
                <span className="opacity-60">|</span>
                <span>{recorderStats.formattedSize}</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Controls Footer */}
      <div className="absolute bottom-0 left-0 w-full z-50 px-6 py-6 pb-[calc(24px+env(safe-area-inset-bottom,0px))] bg-gradient-to-t from-black/95 via-black/60 to-transparent flex flex-col items-center space-y-4">
        
        {/* Settings selectors row (Only in photo mode) */}
        {!onVideoRecorded && (
          <div className="flex gap-6 justify-center w-full mb-2">
            {/* Auto Capture Interval Selector */}
            <div className="flex flex-col items-center gap-1.5">
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Auto Interval</span>
              <div className="bg-black/60 border border-white/10 rounded-full px-3 py-1">
                <select
                  value={autoCaptureInterval}
                  onChange={(e) => setAutoCaptureInterval(Number(e.target.value))}
                  disabled={isAutoCapturing || isBurstCapturing}
                  className="bg-transparent border-none text-white text-xs py-0.5 px-1 focus:outline-none cursor-pointer disabled:opacity-50"
                >
                  <option value={500} className="bg-slate-900 text-white">0.5 Detik</option>
                  <option value={1000} className="bg-slate-900 text-white">1.0 Detik</option>
                  <option value={2000} className="bg-slate-900 text-white">2.0 Detik</option>
                  <option value={5000} className="bg-slate-900 text-white">5.0 Detik</option>
                </select>
              </div>
            </div>

            {/* Burst Count Selector */}
            <div className="flex flex-col items-center gap-1.5">
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Burst Count</span>
              <div className="bg-black/60 border border-white/10 rounded-full px-3 py-1">
                <select
                  value={burstCount}
                  onChange={(e) => setBurstCount(Number(e.target.value))}
                  disabled={isAutoCapturing || isBurstCapturing}
                  className="bg-transparent border-none text-white text-xs py-0.5 px-1 focus:outline-none cursor-pointer disabled:opacity-50"
                >
                  <option value={3} className="bg-slate-900 text-white">3 Foto</option>
                  <option value={5} className="bg-slate-900 text-white">5 Foto</option>
                  <option value={10} className="bg-slate-900 text-white">10 Foto</option>
                  <option value={20} className="bg-slate-900 text-white">20 Foto</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Shutter controls */}
        {onVideoRecorded ? (
          <div className="flex items-center justify-center w-full">
            {recorderState === 'inactive' ? (
              <button
                onClick={handleStartRecording}
                disabled={!isCameraActive}
                className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-500 active:scale-95 disabled:bg-slate-800 flex items-center justify-center shadow-lg shadow-red-500/20 transition-all border-4 border-slate-955"
                title="Mulai Rekam"
              >
                <div className="w-5 h-5 rounded bg-white" />
              </button>
            ) : (
              <div className="flex items-center space-x-6">
                {recorderState === 'recording' ? (
                  <button
                    onClick={pauseRecording}
                    className="p-3 text-amber-500 bg-slate-900/80 border border-white/10 hover:bg-slate-800 rounded-full transition-all"
                    title="Jeda Rekam"
                  >
                    <Pause className="w-5 h-5" />
                  </button>
                ) : (
                  <button
                    onClick={resumeRecording}
                    className="p-3 text-green-500 bg-slate-900/80 border border-white/10 hover:bg-slate-800 rounded-full transition-all"
                    title="Lanjutkan Rekam"
                  >
                    <Play className="w-5 h-5" />
                  </button>
                )}
                <button
                  onClick={handleStopRecording}
                  className="p-4 text-white bg-red-650 hover:bg-red-550 rounded-full transition-all animate-pulse shadow-lg shadow-red-500/30"
                  title="Stop Rekam"
                >
                  <Square className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between w-full max-w-sm px-4">
            {/* Auto Capture Toggle Button */}
            <button
              onClick={toggleAutoCapture}
              disabled={!isCameraActive || isBurstCapturing}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold active:scale-95 transition-all w-[105px] text-center shadow-md ${
                isAutoCapturing
                  ? 'bg-red-600 hover:bg-red-550 text-white shadow-red-500/20'
                  : 'bg-white/10 hover:bg-white/15 text-slate-200 border border-white/10'
              }`}
            >
              {isAutoCapturing ? 'Stop Auto' : 'Auto Capture'}
            </button>

            {/* Shutter Button */}
            <button
              onClick={handleCapture}
              disabled={!isCameraActive || isAutoCapturing || isBurstCapturing}
              className="w-[72px] h-[72px] rounded-full bg-white hover:scale-105 active:scale-95 disabled:bg-slate-500 disabled:scale-100 flex items-center justify-center shadow-lg shadow-white/30 transition-all border-4 border-slate-950 cursor-pointer"
              title="Ambil Foto"
            >
              <div className="w-[52px] h-[52px] rounded-full border-2 border-slate-950 bg-white" />
            </button>

            {/* Burst Button */}
            <button
              onClick={handleBurstCapture}
              disabled={!isCameraActive || isAutoCapturing || isBurstCapturing}
              className="px-4 py-2.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/15 text-slate-200 border border-white/10 active:scale-95 disabled:opacity-30 disabled:scale-100 transition-all w-[105px] text-center shadow-md"
            >
              {isBurstCapturing ? 'Bursting...' : 'Burst'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
