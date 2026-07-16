"use client";

import React, { useRef, useEffect } from 'react';
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

  // Handle camera start/stop on active state change
  useEffect(() => {
    if (isActive && videoRef.current) {
      startCamera(videoRef.current, facingMode).catch((err) => {
        console.error("Gagal menjalankan kamera:", err);
      });
    } else {
      stopCamera(videoRef.current);
    }
    return () => {
      stopCamera(videoRef.current);
    };
  }, [isActive, startCamera, stopCamera, facingMode]);

  const handleCapture = async () => {
    if (!videoRef.current || !isCameraActive) return;
    try {
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
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/95 backdrop-blur-sm transition-all duration-300">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
        <div className="flex items-center space-x-3">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
          <h3 className="font-semibold text-slate-100 text-base">{title}</h3>
        </div>
        <button
          onClick={() => {
            cancelRecording();
            onClose();
          }}
          className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Camera Viewport Area */}
      <div className="relative flex-1 flex items-center justify-center overflow-hidden bg-slate-950 p-4">
        {error ? (
          <div className="text-center p-6 max-w-md">
            <p className="text-red-400 font-medium mb-3">Akses Kamera Gagal</p>
            <p className="text-slate-400 text-sm">{error}</p>
            <button
              onClick={() => videoRef.current && startCamera(videoRef.current, facingMode)}
              className="mt-4 px-4 py-2 bg-slate-800 text-slate-200 rounded-lg hover:bg-slate-700 text-sm transition-colors"
            >
              Coba Lagi
            </button>
          </div>
        ) : (
          <div className="relative w-full max-w-2xl aspect-[4/3] rounded-xl overflow-hidden border border-slate-800 shadow-2xl bg-black">
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
              <div className="absolute top-4 left-4 flex items-center space-x-3 px-3 py-1.5 bg-red-600/90 text-white text-xs font-semibold rounded-full shadow-lg backdrop-blur-sm animate-pulse">
                <div className="w-2 h-2 rounded-full bg-white animate-ping" />
                <span>REC</span>
                <span className="opacity-60">|</span>
                <span>{recorderStats.formattedTime}</span>
                <span className="opacity-60">|</span>
                <span>{recorderStats.formattedSize}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Controls Footer */}
      <div className="px-6 py-6 border-t border-slate-800 bg-slate-900/50 flex flex-col items-center space-y-4">
        {/* Shutter controls */}
        <div className="flex items-center justify-center space-x-8 w-full max-w-md">
          {/* Switch Camera */}
          <button
            onClick={handleToggleCamera}
            disabled={!isCameraActive || recorderState !== 'inactive'}
            className="p-3 text-slate-300 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 rounded-full transition-all"
            title="Ganti Kamera"
          >
            <RefreshCw className="w-5 h-5" />
          </button>

          {/* Core Shutter (Take Photo) */}
          <button
            onClick={handleCapture}
            disabled={!isCameraActive || recorderState !== 'inactive'}
            className="w-16 h-16 rounded-full bg-blue-600 hover:bg-blue-500 active:scale-95 disabled:bg-slate-800 disabled:text-slate-600 flex items-center justify-center shadow-lg shadow-blue-500/10 transition-all border-4 border-slate-950"
            title="Ambil Foto"
          >
            <Camera className="w-6 h-6 text-white" />
          </button>

          {/* Video Recording Switch */}
          {onVideoRecorded && (
            <>
              {recorderState === 'inactive' ? (
                <button
                  onClick={handleStartRecording}
                  disabled={!isCameraActive}
                  className="p-3 text-red-500 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 rounded-full transition-all"
                  title="Rekam Video"
                >
                  <Video className="w-5 h-5" />
                </button>
              ) : (
                <div className="flex items-center space-x-2">
                  {recorderState === 'recording' ? (
                    <button
                      onClick={pauseRecording}
                      className="p-3 text-amber-500 bg-slate-800 hover:bg-slate-700 rounded-full transition-all"
                      title="Jeda Rekam"
                    >
                      <Pause className="w-5 h-5" />
                    </button>
                  ) : (
                    <button
                      onClick={resumeRecording}
                      className="p-3 text-green-500 bg-slate-800 hover:bg-slate-700 rounded-full transition-all"
                      title="Lanjutkan Rekam"
                    >
                      <Play className="w-5 h-5" />
                    </button>
                  )}
                  <button
                    onClick={handleStopRecording}
                    className="p-3 text-red-500 bg-red-100 hover:bg-red-200 rounded-full transition-all animate-pulse"
                    title="Stop Rekam"
                  >
                    <Square className="w-5 h-5" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
