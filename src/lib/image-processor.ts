/**
 * Image processing pipeline helpers ported from data-collector-hf
 */

interface ProcessOptions {
  maxSize?: number;
  quality?: number;
  autoRotate?: boolean;
  thumbnailSize?: number;
}

interface ProcessResult {
  processed: Blob;
  thumbnail: Blob;
  width: number;
  height: number;
  originalSize: number;
  processedSize: number;
}

interface QualityOptions {
  minWidth?: number;
  minHeight?: number;
  blurThreshold?: number;
  darkThreshold?: number;
  brightThreshold?: number;
  noiseThreshold?: number;
  analysisSize?: number;
}

interface QualityResult {
  passed: boolean;
  issues: string[];
  scores: {
    sharpness: number;
    brightness: number;
    noise: number;
    resolution: {
      width: number;
      height: number;
    };
  };
}

/**
 * Membaca orientasi EXIF dari blob gambar JPEG secara manual tanpa library tambahan
 */
function getOrientation(blob: Blob): Promise<number> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = function (e) {
      if (!e.target?.result || !(e.target.result instanceof ArrayBuffer)) {
        return resolve(-2);
      }
      const view = new DataView(e.target.result);
      if (view.byteLength < 2 || view.getUint16(0, false) !== 0xffd8) {
        return resolve(-2); // Bukan JPEG
      }
      const length = view.byteLength;
      let offset = 2;
      while (offset < length) {
        if (offset + 2 > length) break;
        const marker = view.getUint16(offset, false);
        offset += 2;
        if (marker === 0xffe1) {
          if (offset + 8 > length) break;
          if (view.getUint32(offset + 2, false) !== 0x45786966) {
            return resolve(-1); // Bukan header EXIF
          }
          const little = view.getUint16(offset + 8, false) === 0x4949;
          const tiffOffset = offset + 8;
          let idfOffset = tiffOffset + view.getUint32(tiffOffset + 4, little);
          if (idfOffset + 2 > length) break;
          const tags = view.getUint16(idfOffset, little);
          idfOffset += 2;
          for (let i = 0; i < tags; i++) {
            if (idfOffset + 12 > length) break;
            if (view.getUint16(idfOffset, little) === 0x0112) {
              return resolve(view.getUint16(idfOffset + 8, little));
            }
            idfOffset += 12;
          }
        } else if ((marker & 0xff00) === 0xff00) {
          if (offset + 2 > length) break;
          offset += view.getUint16(offset, false);
        } else {
          break;
        }
      }
      return resolve(-1);
    };
    reader.readAsArrayBuffer(blob.slice(0, 64 * 1024));
  });
}

/**
 * Memuat gambar dari Blob/File ke elemen Image HTML
 */
function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
}

/**
 * Mengubah ukuran gambar dan menerapkan rotasi berdasarkan EXIF orientation
 */
function resizeAndRotateImage(
  img: HTMLImageElement,
  orientation: number,
  maxSize: number,
  quality: number
): Promise<{ blob: Blob; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    try {
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;

      // Hitung dimensi target berdasarkan aspect ratio
      let targetWidth = width;
      let targetHeight = height;

      if (width > height) {
        if (width > maxSize) {
          targetHeight = Math.round((height * maxSize) / width);
          targetWidth = maxSize;
        }
      } else {
        if (height > maxSize) {
          targetWidth = Math.round((width * maxSize) / height);
          targetHeight = maxSize;
        }
      }

      // Tentukan apakah dimensi perlu dibalik (untuk rotasi 90 / 270 derajat)
      const swapDimensions = orientation >= 5 && orientation <= 8;
      const canvasWidth = swapDimensions ? targetHeight : targetWidth;
      const canvasHeight = swapDimensions ? targetWidth : targetHeight;

      const canvas = document.createElement('canvas');
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return reject(new Error('Gagal mendapatkan 2D context.'));
      }

      // Terapkan transformasi rotasi
      switch (orientation) {
        case 2: // Flip Horizontal
          ctx.translate(canvasWidth, 0);
          ctx.scale(-1, 1);
          break;
        case 3: // Rotasi 180
          ctx.translate(canvasWidth, canvasHeight);
          ctx.rotate(Math.PI);
          break;
        case 4: // Flip Vertikal
          ctx.translate(0, canvasHeight);
          ctx.scale(1, -1);
          break;
        case 5: // Flip Horiz + Rotasi 90 deg CCW
          ctx.rotate(0.5 * Math.PI);
          ctx.scale(1, -1);
          break;
        case 6: // Rotasi 90 deg CW
          ctx.translate(canvasWidth, 0);
          ctx.rotate(0.5 * Math.PI);
          break;
        case 7: // Flip Horiz + Rotasi 90 deg CW
          ctx.rotate(-0.5 * Math.PI);
          ctx.translate(-canvasWidth, -canvasHeight);
          ctx.scale(-1, 1);
          break;
        case 8: // Rotasi 270 deg CW (90 deg CCW)
          ctx.translate(0, canvasHeight);
          ctx.rotate(-0.5 * Math.PI);
          break;
        default:
          break;
      }

      // Gambar ke canvas dengan dimensi target awal (sebelum pertukaran rotasi)
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

      // Konversi ke Blob JPEG
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            return reject(new Error('Gagal kompresi canvas ke blob.'));
          }
          resolve({
            blob,
            width: canvasWidth,
            height: canvasHeight
          });
        },
        'image/jpeg',
        quality
      );
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Pipeline pemrosesan gambar utama: Resize, Auto-rotate (EXIF), Compress ke JPEG, Strip EXIF, dan generate Thumbnail.
 */
export async function processImage(blob: Blob, options: ProcessOptions = {}): Promise<ProcessResult> {
  const defaults = {
    maxSize: 1280,
    quality: 0.85,
    autoRotate: true,
    thumbnailSize: 200
  };

  const config = { ...defaults, ...options };
  const originalSize = blob.size;

  let orientation = 1;
  if (config.autoRotate) {
    try {
      orientation = await getOrientation(blob);
    } catch (e) {
      console.warn('Gagal membaca orientasi EXIF, menggunakan orientasi normal.', e);
    }
  }

  const img = await loadImage(blob);
  
  const processedResult = await resizeAndRotateImage(img, orientation, config.maxSize, config.quality);
  const thumbnailResult = await resizeAndRotateImage(img, orientation, config.thumbnailSize, 0.7);

  return {
    processed: processedResult.blob,
    thumbnail: thumbnailResult.blob,
    width: processedResult.width,
    height: processedResult.height,
    originalSize,
    processedSize: processedResult.blob.size
  };
}

/**
 * Konversi ImageData ke Grayscale (Luminance)
 */
function getGrayscaleData(imageData: ImageData): Uint8Array {
  const data = imageData.data;
  const len = data.length;
  const grayscale = new Uint8Array(len / 4);
  for (let i = 0, j = 0; i < len; i += 4, j++) {
    grayscale[j] = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
  }
  return grayscale;
}

/**
 * Deteksi Blur menggunakan Laplacian Variance (Metode Sobel/Laplacian)
 */
function checkBlur(grayscale: Uint8Array, width: number, height: number): number {
  let sum = 0;
  let sumSq = 0;
  const count = (width - 2) * (height - 2);

  if (count <= 0) return 0;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      
      const val = 
        grayscale[idx - width] + 
        grayscale[idx - 1] +     
        grayscale[idx + 1] +     
        grayscale[idx + width] - 
        4 * grayscale[idx];      

      sum += val;
      sumSq += val * val;
    }
  }

  const mean = sum / count;
  const variance = (sumSq / count) - (mean * mean);
  return variance;
}

/**
 * Deteksi kecerahan rata-rata (Brightness)
 */
function checkBrightness(grayscale: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < grayscale.length; i++) {
    sum += grayscale[i];
  }
  return sum / grayscale.length;
}

/**
 * Deteksi noise sederhana
 */
function checkNoise(grayscale: Uint8Array, width: number, height: number): number {
  let diffSum = 0;
  let diffSumSq = 0;
  let count = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width - 1; x++) {
      const idx = y * width + x;
      const diff = Math.abs(grayscale[idx] - grayscale[idx + 1]);
      diffSum += diff;
      diffSumSq += diff * diff;
      count++;
    }
  }

  if (count === 0) return 0;
  const mean = diffSum / count;
  const variance = (diffSumSq / count) - (mean * mean);
  return Math.sqrt(variance);
}

/**
 * Fungsi utama pemeriksaan kualitas gambar
 */
export async function checkQuality(blob: Blob, options: QualityOptions = {}): Promise<QualityResult> {
  const defaults = {
    minWidth: 480,
    minHeight: 480,
    blurThreshold: 5,        
    darkThreshold: 0,        // Deteksi kecerahan gelap dinonaktifkan
    brightThreshold: 225,    
    noiseThreshold: 35,      
    analysisSize: 160        
  };

  const config = { ...defaults, ...options };
  const issues: string[] = [];

  try {
    const img = await loadImage(blob);
    const originalWidth = img.naturalWidth || img.width;
    const originalHeight = img.naturalHeight || img.height;

    if (originalWidth < config.minWidth || originalHeight < config.minHeight) {
      issues.push('small');
    }

    const targetWidth = config.analysisSize;
    const targetHeight = Math.round((originalHeight * config.analysisSize) / originalWidth);

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Gagal mendapatkan 2D context.');
    }
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
    
    if (!imageData || imageData.data.length === 0) {
      return {
        passed: false,
        issues: ['corrupt'],
        scores: { sharpness: 0, brightness: 0, noise: 0, resolution: { width: originalWidth, height: originalHeight } }
      };
    }

    const grayscale = getGrayscaleData(imageData);
    const brightness = checkBrightness(grayscale);
    const blurScore = checkBlur(grayscale, targetWidth, targetHeight);
    const noiseScore = checkNoise(grayscale, targetWidth, targetHeight);

    // Periksa kecerahan (hanya periksa jika terlalu terang atau jika darkThreshold diatur > 0 secara eksplisit)
    if (config.darkThreshold > 0 && brightness < config.darkThreshold) {
      issues.push('dark');
    } else if (brightness > config.brightThreshold) {
      issues.push('bright');
    }

    if (blurScore < config.blurThreshold) {
      issues.push('blur');
    }

    if (noiseScore > config.noiseThreshold) {
      issues.push('noise');
    }

    return {
      passed: issues.length === 0,
      issues,
      scores: {
        sharpness: Math.round(blurScore * 10) / 10,
        brightness: Math.round(brightness * 10) / 10,
        noise: Math.round(noiseScore * 10) / 10,
        resolution: { width: originalWidth, height: originalHeight }
      }
    };
  } catch (err) {
    console.error('Error analyzing image quality:', err);
    return {
      passed: false,
      issues: ['corrupt'],
      scores: { sharpness: 0, brightness: 0, noise: 0, resolution: { width: 0, height: 0 } }
    };
  }
}

/**
 * Smart Filter Class - Similarity Analysis
 */
export class SmartFilter {
  threshold: number;
  analysisSize: number;
  previousFrameData: Uint8ClampedArray | null;

  constructor(threshold = 0.12, analysisSize = 32) {
    this.threshold = threshold;
    this.analysisSize = analysisSize;
    this.previousFrameData = null;
  }

  setThreshold(val: number) {
    this.threshold = Number(val);
  }

  reset() {
    this.previousFrameData = null;
  }

  private async getAnalysisData(
    source: Blob | HTMLCanvasElement | HTMLVideoElement
  ): Promise<Uint8ClampedArray> {
    const canvas = document.createElement('canvas');
    canvas.width = this.analysisSize;
    canvas.height = this.analysisSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Gagal mendapatkan 2D context.');
    }

    if (source instanceof Blob) {
      const img = await loadImage(source);
      ctx.drawImage(img, 0, 0, this.analysisSize, this.analysisSize);
    } else {
      ctx.drawImage(source, 0, 0, this.analysisSize, this.analysisSize);
    }

    const imgData = ctx.getImageData(0, 0, this.analysisSize, this.analysisSize);
    return imgData.data;
  }

  async shouldKeepFrame(source: Blob | HTMLCanvasElement | HTMLVideoElement): Promise<boolean> {
    try {
      const currentData = await this.getAnalysisData(source);

      if (!this.previousFrameData) {
        this.previousFrameData = currentData;
        return true;
      }

      const difference = this.calculateDifference(currentData, this.previousFrameData);

      if (difference >= this.threshold) {
        this.previousFrameData = currentData;
        return true;
      }

      return false;
    } catch (err) {
      console.error('Error in smart filter analysis:', err);
      return true; // Fallback
    }
  }

  private calculateDifference(data1: Uint8ClampedArray, data2: Uint8ClampedArray): number {
    let diffSum = 0;
    const len = data1.length;
    let pixelsCount = 0;

    for (let i = 0; i < len; i += 4) {
      const rDiff = Math.abs(data1[i] - data2[i]);
      const gDiff = Math.abs(data1[i + 1] - data2[i + 1]);
      const bDiff = Math.abs(data1[i + 2] - data2[i + 2]);

      diffSum += (rDiff + gDiff + bDiff) / 3;
      pixelsCount++;
    }

    return diffSum / pixelsCount / 255;
  }
}
