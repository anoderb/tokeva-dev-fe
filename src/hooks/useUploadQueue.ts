import { useState, useEffect, useRef, useCallback } from 'react';
import { uploadSinglePhoto } from '../lib/upload';
import { PhotoHf } from '../lib/supabase';

export interface QueueItem {
  id: string;
  datasetId: string;
  datasetSlug: string;
  blob: Blob;
  thumbnail: Blob | null;
  width: number;
  height: number;
  fileName?: string;
  attempts: number;
  status: 'pending' | 'uploading' | 'failed-retry' | 'failed' | 'success';
  error?: string;
}

export interface QueueStats {
  isOnline: boolean;
  isPaused: boolean;
  pendingCount: number;
  uploadingCount: number;
  completedCount: number;
  failedCount: number;
  totalCount: number;
  progressPercent: number;
}

interface UseUploadQueueOptions {
  concurrency?: number;
  maxRetries?: number;
  retryDelay?: number;
  onItemSuccess?: (result: PhotoHf) => void;
  onItemFailure?: (itemId: string, error: string, permanent: boolean) => void;
}

export function useUploadQueue(options: UseUploadQueueOptions = {}) {
  const {
    concurrency = 2,
    maxRetries = 3,
    retryDelay = 3000,
    onItemSuccess,
    onItemFailure
  } = options;

  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [activeUploads, setActiveUploads] = useState<number>(0);
  const [completedCount, setCompletedCount] = useState<number>(0);
  const [failedCount, setFailedCount] = useState<number>(0);
  const [totalSubmitted, setTotalSubmitted] = useState<number>(0);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isPaused, setIsPaused] = useState<boolean>(false);

  // Use refs to avoid closures issues in background loops
  const queueRef = useRef<QueueItem[]>([]);
  const activeUploadsRef = useRef<number>(0);
  const isOnlineRef = useRef<boolean>(true);
  const isPausedRef = useRef<boolean>(false);

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  useEffect(() => {
    activeUploadsRef.current = activeUploads;
  }, [activeUploads]);

  useEffect(() => {
    isOnlineRef.current = isOnline;
  }, [isOnline]);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  const getStats = useCallback((): QueueStats => {
    const pendingCount = queue.filter(
      (q) => q.status === 'pending' || q.status === 'failed-retry'
    ).length;
    
    return {
      isOnline,
      isPaused,
      pendingCount,
      uploadingCount: activeUploads,
      completedCount,
      failedCount,
      totalCount: totalSubmitted,
      progressPercent: totalSubmitted > 0 ? Math.round((completedCount / totalSubmitted) * 100) : 0
    };
  }, [queue, activeUploads, completedCount, failedCount, totalSubmitted, isOnline, isPaused]);

  const processQueue = useCallback(async () => {
    if (
      isPausedRef.current ||
      !isOnlineRef.current ||
      activeUploadsRef.current >= concurrency
    ) {
      return;
    }

    const nextItemIndex = queueRef.current.findIndex(
      (item) => item.status === 'pending' || item.status === 'failed-retry'
    );

    if (nextItemIndex === -1) {
      return;
    }

    const nextItem = queueRef.current[nextItemIndex];
    
    // Set status to uploading
    setQueue((prev) =>
      prev.map((item) =>
        item.id === nextItem.id ? { ...item, status: 'uploading' } : item
      )
    );
    setActiveUploads((prev) => prev + 1);

    // Run upload asynchronously
    (async () => {
      try {
        const result = await uploadSinglePhoto({
          datasetId: nextItem.datasetId,
          datasetSlug: nextItem.datasetSlug,
          processedBlob: nextItem.blob,
          thumbnail: nextItem.thumbnail,
          width: nextItem.width,
          height: nextItem.height,
          fileName: nextItem.fileName
        });

        // Update state on success
        setQueue((prev) => prev.filter((q) => q.id !== nextItem.id));
        setCompletedCount((prev) => prev + 1);
        
        if (onItemSuccess) {
          onItemSuccess(result);
        }
      } catch (err: any) {
        console.error(`Gagal mengunggah item ${nextItem.id}:`, err);
        const nextAttempts = nextItem.attempts + 1;

        if (nextAttempts < maxRetries && isOnlineRef.current) {
          setQueue((prev) =>
            prev.map((item) =>
              item.id === nextItem.id
                ? { ...item, status: 'failed-retry', attempts: nextAttempts, error: err.message || 'Error' }
                : item
            )
          );
          if (onItemFailure) {
            onItemFailure(nextItem.id, err.message || 'Error', false);
          }

          setTimeout(() => {
            processQueue();
          }, retryDelay);
        } else {
          setQueue((prev) =>
            prev.map((item) =>
              item.id === nextItem.id
                ? { ...item, status: 'failed', attempts: nextAttempts, error: err.message || 'Error' }
                : item
            )
          );
          setFailedCount((prev) => prev + 1);
          if (onItemFailure) {
            onItemFailure(nextItem.id, err.message || 'Error', true);
          }
        }
      } finally {
        setActiveUploads((prev) => Math.max(0, prev - 1));
        // Continue processing queue
        setTimeout(processQueue, 50);
      }
    })();

    // Attempt processing another item in parallel if slots remain
    setTimeout(processQueue, 50);
  }, [concurrency, maxRetries, retryDelay, onItemSuccess, onItemFailure]);

  const add = useCallback((item: {
    datasetId: string;
    datasetSlug: string;
    blob: Blob;
    thumbnail: Blob | null;
    width: number;
    height: number;
    fileName?: string;
  }) => {
    const newItem: QueueItem = {
      id: `up-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      attempts: 0,
      status: 'pending',
      ...item
    };

    setQueue((prev) => [...prev, newItem]);
    setTotalSubmitted((prev) => prev + 1);
    
    setTimeout(processQueue, 50);
    return newItem.id;
  }, [processQueue]);

  const addBatch = useCallback((items: {
    datasetId: string;
    datasetSlug: string;
    blob: Blob;
    thumbnail: Blob | null;
    width: number;
    height: number;
    fileName?: string;
  }[]) => {
    const ids: string[] = [];
    const newItems = items.map((item) => {
      const id = `up-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      ids.push(id);
      return {
        id,
        attempts: 0,
        status: 'pending' as const,
        ...item
      };
    });

    setQueue((prev) => [...prev, ...newItems]);
    setTotalSubmitted((prev) => prev + items.length);

    setTimeout(processQueue, 50);
    return ids;
  }, [processQueue]);

  const retryAllFailed = useCallback(() => {
    setQueue((prev) =>
      prev.map((item) =>
        item.status === 'failed' ? { ...item, status: 'pending', attempts: 0 } : item
      )
    );
    setFailedCount(0);
    setTimeout(processQueue, 50);
  }, [processQueue]);

  const clear = useCallback(() => {
    setQueue([]);
    setActiveUploads(0);
    setCompletedCount(0);
    setFailedCount(0);
    setTotalSubmitted(0);
  }, []);

  // Monitor network status
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      setIsOnline(true);
      setIsPaused(false);
      setTimeout(processQueue, 50);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setIsPaused(true);
    };

    setIsOnline(navigator.onLine);
    setIsPaused(!navigator.onLine);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [processQueue]);

  return {
    queue,
    stats: getStats(),
    add,
    addBatch,
    retryAllFailed,
    clear,
    isOnline,
    isPaused,
    setIsPaused
  };
}
