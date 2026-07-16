import { useCallback } from 'react';

interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  approxFps: number;
}

interface ExtractionEstimate {
  duration: number;
  formattedDuration: string;
  resolution: string;
  approxFps: number;
  estimatedFrames: number;
  estimatedStorage: string;
  estimatedTimeSec: number;
  formattedEstimatedTime: string;
}

interface ExtractionConfig {
  mode: 'fps' | 'interval';
  value: number;
}

export function useFrameExtractor() {
  const formatTime = (seconds: number): string => {
    if (isNaN(seconds)) return '00:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getVideoMetadata = useCallback((videoBlob: Blob): Promise<VideoMetadata> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      
      const url = URL.createObjectURL(videoBlob);
      
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(url);
        resolve({
          duration: video.duration,
          width: video.videoWidth,
          height: video.videoHeight,
          approxFps: 30
        });
      };

      video.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Gagal memuat metadata video. File mungkin rusak atau format tidak didukung.'));
      };

      video.src = url;
    });
  }, []);

  const estimateExtraction = useCallback((
    metadata: VideoMetadata,
    config: ExtractionConfig
  ): ExtractionEstimate => {
    const { duration } = metadata;
    let totalEstimatedFrames = 0;

    if (config.mode === 'fps') {
      totalEstimatedFrames = Math.max(1, Math.floor(duration * config.value));
    } else {
      totalEstimatedFrames = Math.max(1, Math.floor(duration / config.value));
    }

    const averageFrameSizeKB = 150;
    const estimatedStorageBytes = totalEstimatedFrames * averageFrameSizeKB * 1024;
    const processTimePerFrameMs = 80;
    const estimatedTimeSec = Math.ceil((totalEstimatedFrames * processTimePerFrameMs) / 1000);

    return {
      duration: duration,
      formattedDuration: formatTime(duration),
      resolution: `${metadata.width}x${metadata.height}`,
      approxFps: metadata.approxFps,
      estimatedFrames: totalEstimatedFrames,
      estimatedStorage: formatSize(estimatedStorageBytes),
      estimatedTimeSec: estimatedTimeSec,
      formattedEstimatedTime: formatTime(estimatedTimeSec)
    };
  }, []);

  const extractFrames = useCallback((
    videoBlob: Blob,
    config: ExtractionConfig,
    onFrameExtracted: (blob: Blob, timestamp: number, index: number) => Promise<void>,
    onProgress?: (currentFrame: number, totalFrames: number, percent: number) => void
  ): Promise<{ totalFramesExtracted: number }> => {
    return new Promise(async (resolve, reject) => {
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;

      const url = URL.createObjectURL(videoBlob);
      video.src = url;

      try {
        await new Promise<void>((res, rej) => {
          video.onloadedmetadata = () => res();
          video.onerror = () => rej(new Error('Gagal memuat metadata video.'));
        });

        const duration = video.duration;
        const width = video.videoWidth;
        const height = video.videoHeight;

        let stepSize = 0.5; // default 2 FPS
        if (config.mode === 'fps') {
          stepSize = 1 / config.value;
        } else {
          stepSize = config.value;
        }

        const timestamps: number[] = [];
        for (let t = 0; t < duration; t += stepSize) {
          timestamps.push(t);
        }

        if (timestamps.length === 0) {
          timestamps.push(0);
        }

        const totalFrames = timestamps.length;
        let currentIndex = 0;

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('Gagal mendapatkan 2D context.');
        }

        const captureNextFrame = () => {
          if (currentIndex >= totalFrames) {
            URL.revokeObjectURL(url);
            resolve({ totalFramesExtracted: totalFrames });
            return;
          }

          const targetTime = timestamps[currentIndex];
          video.currentTime = targetTime;
        };

        video.onseeked = async () => {
          try {
            ctx.drawImage(video, 0, 0, width, height);

            const frameBlob = await new Promise<Blob>((resBlob, rejBlob) => {
              canvas.toBlob(
                (blob) => {
                  if (blob) resBlob(blob);
                  else rejBlob(new Error('Canvas toBlob return null.'));
                },
                'image/jpeg',
                0.95
              );
            });

            await onFrameExtracted(frameBlob, timestamps[currentIndex], currentIndex + 1);

            currentIndex++;
            const percent = Math.round((currentIndex / totalFrames) * 100);
            
            if (onProgress) {
              onProgress(currentIndex, totalFrames, percent);
            }

            captureNextFrame();
          } catch (err) {
            URL.revokeObjectURL(url);
            reject(err);
          }
        };

        if (onProgress) {
          onProgress(0, totalFrames, 0);
        }
        captureNextFrame();

      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    });
  }, []);

  return {
    getVideoMetadata,
    estimateExtraction,
    extractFrames,
    formatTime,
    formatSize
  };
}
