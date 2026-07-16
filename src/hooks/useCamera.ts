import { useState, useEffect, useRef, useCallback } from 'react';

export type FacingMode = 'environment' | 'user';

interface RecorderStats {
  state: 'inactive' | 'recording' | 'paused';
  elapsedTime: number;
  formattedTime: string;
  fileSize: number;
  formattedSize: string;
  resolution: string;
  fps: number;
}

export function useCamera() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<FacingMode>('environment');
  const [activeFacingMode, setActiveFacingMode] = useState<FacingMode>('environment');
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Video Recorder State
  const [recorderState, setRecorderState] = useState<'inactive' | 'recording' | 'paused'>('inactive');
  const [recorderStats, setRecorderStats] = useState<RecorderStats>({
    state: 'inactive',
    elapsedTime: 0,
    formattedTime: '00:00',
    fileSize: 0,
    formattedSize: '0 B',
    resolution: 'Unknown',
    fps: 30
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordedSizeRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const elapsedTimeRef = useRef<number>(0);
  const timerIdRef = useRef<NodeJS.Timeout | null>(null);
  const onUpdateCallbackRef = useRef<((stats: RecorderStats) => void) | null>(null);

  const getActiveFacingMode = (streamInstance: MediaStream): FacingMode | null => {
    try {
      const videoTrack = streamInstance.getVideoTracks()[0];
      if (videoTrack && typeof videoTrack.getSettings === 'function') {
        const settings = videoTrack.getSettings();
        return settings.facingMode as FacingMode;
      }
    } catch (e) {
      // Ignore
    }
    return null;
  };

  const getSupportedMimeType = (): { mimeType?: string } => {
    const types = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
      'video/mp4;codecs=h264',
      'video/mp4'
    ];
    for (const type of types) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
        return { mimeType: type };
      }
    }
    return {};
  };

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getRecorderStats = useCallback(() => {
    if (!stream) return recorderStats;
    const videoTrack = stream.getVideoTracks()[0];
    const settings = videoTrack ? videoTrack.getSettings() : null;
    return {
      state: mediaRecorderRef.current ? (mediaRecorderRef.current.state as any) : 'inactive',
      elapsedTime: elapsedTimeRef.current,
      formattedTime: formatTime(elapsedTimeRef.current),
      fileSize: recordedSizeRef.current,
      formattedSize: formatSize(recordedSizeRef.current),
      resolution: settings ? `${settings.width}x${settings.height}` : 'Unknown',
      fps: settings?.frameRate ? Math.round(settings.frameRate) : 30
    };
  }, [stream, recorderStats]);

  const stopCamera = useCallback((videoElement: HTMLVideoElement | null) => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    if (videoElement) {
      videoElement.srcObject = null;
    }
    setIsCameraActive(false);
  }, [stream]);

  const startCamera = useCallback(async (
    videoElement: HTMLVideoElement,
    mode: FacingMode = 'environment'
  ) => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const errMsg = 'Camera API tidak didukung di browser ini. Pastikan Anda menggunakan koneksi HTTPS/localhost.';
      setError(errMsg);
      throw new Error(errMsg);
    }

    // Clean active stream
    if (videoElement.srcObject) {
      const activeStream = videoElement.srcObject as MediaStream;
      activeStream.getTracks().forEach((track) => track.stop());
    }

    const constraints = {
      video: {
        facingMode: { ideal: mode },
        width: { ideal: 3840 },
        height: { ideal: 2160 }
      },
      audio: false
    };

    try {
      setError(null);
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      videoElement.srcObject = newStream;

      await new Promise<void>((resolve) => {
        videoElement.onloadedmetadata = () => {
          videoElement.play().then(() => resolve());
        };
      });

      const actualFacing = getActiveFacingMode(newStream) || mode;
      setActiveFacingMode(actualFacing);
      setFacingMode(mode);

      if (actualFacing === 'user') {
        videoElement.style.transform = 'scaleX(-1)';
      } else {
        videoElement.style.transform = 'scaleX(1)';
      }

      setStream(newStream);
      setIsCameraActive(true);
      return newStream;
    } catch (err: any) {
      console.warn('Failed to start ideal camera, attempting fallback...', err);
      try {
        const fallbackConstraints = { video: true, audio: false };
        const fallbackStream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
        videoElement.srcObject = fallbackStream;
        await videoElement.play();
        setStream(fallbackStream);
        setIsCameraActive(true);
        return fallbackStream;
      } catch (fallbackErr: any) {
        setError(fallbackErr.message || 'Gagal mengakses kamera.');
        throw fallbackErr;
      }
    }
  }, []);

  const switchCamera = useCallback(async (videoElement: HTMLVideoElement) => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    return startCamera(videoElement, nextMode);
  }, [facingMode, startCamera]);

  const captureFrameBlob = useCallback((videoElement: HTMLVideoElement): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      try {
        const videoWidth = videoElement.videoWidth;
        const videoHeight = videoElement.videoHeight;

        if (!videoWidth || !videoHeight) {
          return reject(new Error('Kamera tidak aktif atau frame preview belum siap.'));
        }

        const canvas = document.createElement('canvas');
        canvas.width = videoWidth;
        canvas.height = videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('Failed to get 2d canvas context.'));
        }

        const isMirrored = videoElement.style.transform.includes('scaleX(-1)');
        if (isMirrored) {
          ctx.translate(videoWidth, 0);
          ctx.scale(-1, 1);
        }

        ctx.drawImage(videoElement, 0, 0, videoWidth, videoHeight);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              return reject(new Error('Gagal mengekstrak frame video ke blob.'));
            }
            resolve(blob);
          },
          'image/jpeg',
          0.98
        );
      } catch (err) {
        reject(err);
      }
    });
  }, []);

  // Video Recorder Methods
  const startRecording = useCallback((onUpdate?: (stats: RecorderStats) => void) => {
    if (recorderState !== 'inactive' || !stream) return;

    recordedChunksRef.current = [];
    recordedSizeRef.current = 0;
    elapsedTimeRef.current = 0;
    startTimeRef.current = Date.now();
    onUpdateCallbackRef.current = onUpdate || null;

    const options = getSupportedMimeType();
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, options);
    } catch (e) {
      console.warn('Gagal inisialisasi MediaRecorder dengan codec pilihan, menggunakan default.', e);
      recorder = new MediaRecorder(stream);
    }

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        recordedChunksRef.current.push(event.data);
        recordedSizeRef.current += event.data.size;
        
        const currentStats = getRecorderStats();
        setRecorderStats(currentStats);
        if (onUpdateCallbackRef.current) {
          onUpdateCallbackRef.current(currentStats);
        }
      }
    };

    recorder.start(500);
    mediaRecorderRef.current = recorder;
    setRecorderState('recording');

    timerIdRef.current = setInterval(() => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        elapsedTimeRef.current = Math.floor((Date.now() - startTimeRef.current) / 1000);
        const currentStats = getRecorderStats();
        setRecorderStats(currentStats);
        if (onUpdateCallbackRef.current) {
          onUpdateCallbackRef.current(currentStats);
        }
      }
    }, 1000);

    const initialStats = getRecorderStats();
    setRecorderStats(initialStats);
    if (onUpdate) onUpdate(initialStats);
  }, [stream, recorderState, getRecorderStats]);

  const pauseRecording = useCallback(() => {
    if (recorderState !== 'recording' || !mediaRecorderRef.current) return;
    mediaRecorderRef.current.pause();
    setRecorderState('paused');
  }, [recorderState]);

  const resumeRecording = useCallback(() => {
    if (recorderState !== 'paused' || !mediaRecorderRef.current) return;
    const pausedDuration = Date.now() - (startTimeRef.current + elapsedTimeRef.current * 1000);
    startTimeRef.current += pausedDuration;
    mediaRecorderRef.current.resume();
    setRecorderState('recording');
  }, [recorderState]);

  const stopRecording = useCallback((): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      if (recorderState === 'inactive' || !mediaRecorderRef.current) {
        return reject(new Error('Perekam tidak aktif.'));
      }

      mediaRecorderRef.current.onstop = () => {
        if (timerIdRef.current) {
          clearInterval(timerIdRef.current);
          timerIdRef.current = null;
        }
        setRecorderState('inactive');

        const blob = new Blob(recordedChunksRef.current, {
          type: recordedChunksRef.current[0]?.type || 'video/webm'
        });
        resolve(blob);
      };

      mediaRecorderRef.current.stop();
    });
  }, [recorderState]);

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && recorderState !== 'inactive') {
      mediaRecorderRef.current.onstop = null;
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        // Ignore
      }
    }
    if (timerIdRef.current) {
      clearInterval(timerIdRef.current);
      timerIdRef.current = null;
    }
    recordedChunksRef.current = [];
    recordedSizeRef.current = 0;
    setRecorderState('inactive');
  }, [recorderState]);

  // Clean stream on unmount
  useEffect(() => {
    return () => {
      if (timerIdRef.current) {
        clearInterval(timerIdRef.current);
      }
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

  return {
    stream,
    facingMode,
    activeFacingMode,
    isCameraActive,
    error,
    startCamera,
    stopCamera,
    switchCamera,
    captureFrameBlob,
    // Video recording features
    recorderState,
    recorderStats,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    cancelRecording
  };
}
