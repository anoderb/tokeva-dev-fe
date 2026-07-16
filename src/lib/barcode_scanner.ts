import { BrowserMultiFormatReader } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';

export class BarcodeScanner {
  private elementId: string;
  private videoStream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private animationFrameId: number | null = null;
  private zxingReader: BrowserMultiFormatReader | null = null;
  private zxingControls: any = null;

  constructor(elementId: string) {
    this.elementId = elementId;
  }

  // Cek dukungan native BarcodeDetector (ML Kit di Android, Apple detector di iOS/Safari)
  static isNativeSupported(): boolean {
    return typeof window !== 'undefined' && 'BarcodeDetector' in window;
  }

  async start(
    onScanSuccess: (decodedText: string) => void,
    onScanFailure?: (errorMessage: string) => void
  ) {
    try {
      const container = document.getElementById(this.elementId);
      if (!container) throw new Error(`Viewfinder container #${this.elementId} tidak ditemukan.`);

      // Hapus konten kontainer sebelumnya
      container.innerHTML = '';

      // Tentukan format barcode yang didukung oleh native detector
      const nativeFormats = [
        'ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'code_93', 'itf', 'qr_code', 'data_matrix'
      ];

      // Setup kamera stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      this.videoStream = stream;

      // Buat elemen video secara dinamis
      const video = document.createElement('video');
      video.srcObject = stream;
      video.setAttribute('playsinline', 'true');
      video.className = 'w-full h-full object-cover';
      video.autoplay = true;
      container.appendChild(video);
      this.videoElement = video;

      await new Promise<void>((resolve) => {
        video.onloadedmetadata = () => {
          video.play();
          resolve();
        };
      });

      // Pilihan A: Menggunakan Browser Native BarcodeDetector (ML Kit / Hardware Accelerated)
      if (BarcodeScanner.isNativeSupported()) {
        try {
          const detector = new (window as any).BarcodeDetector({ formats: nativeFormats });
          
          let lastDetectTime = 0;
          const detectLoop = async () => {
            if (!this.videoStream || !this.videoElement) return; // stopped

            const now = performance.now();
            // Lakukan pemindaian setiap 80ms (~12 FPS) agar tidak membebani CPU
            if (now - lastDetectTime >= 80) {
              lastDetectTime = now;
              try {
                if (video.readyState === video.HAVE_ENOUGH_DATA) {
                  const barcodes = await detector.detect(video);
                  if (barcodes.length > 0) {
                    onScanSuccess(barcodes[0].rawValue);
                    return; // Hentikan loop pemindaian
                  }
                }
              } catch (err: any) {
                if (onScanFailure) onScanFailure(err?.message || String(err));
              }
            }
            this.animationFrameId = requestAnimationFrame(detectLoop);
          };
          this.animationFrameId = requestAnimationFrame(detectLoop);
          return; // Selesai inisialisasi native scanner
        } catch (nativeErr) {
          console.warn('Native BarcodeDetector gagal diinisialisasi, fallback ke ZXing:', nativeErr);
        }
      }

      // Pilihan B: Menggunakan Fallback @zxing/browser (Zebra Crossing Engine)
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.CODE_128,
        BarcodeFormat.CODE_39,
        BarcodeFormat.CODE_93,
        BarcodeFormat.ITF,
        BarcodeFormat.QR_CODE,
        BarcodeFormat.DATA_MATRIX
      ]);
      hints.set(DecodeHintType.TRY_HARDER, true);

      this.zxingReader = new BrowserMultiFormatReader(hints);
      this.zxingReader.decodeFromVideoElement(video, (result: any, error: any, controls: any) => {
        if (controls) {
          this.zxingControls = controls;
        }
        if (result) {
          onScanSuccess(result.getText());
        }
      });

    } catch (error: any) {
      console.error('Gagal memulai scanner barcode:', error);
      throw error;
    }
  }

  async stop() {
    try {
      // Hentikan loop native detector
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }

      // Hentikan ZXing reader jika aktif
      if (this.zxingControls) {
        try {
          this.zxingControls.stop();
        } catch (e) {}
          this.zxingControls = null;
      }
      this.zxingReader = null;

      // Hentikan track webcam stream
      if (this.videoStream) {
        this.videoStream.getTracks().forEach((track) => track.stop());
        this.videoStream = null;
      }

      // Bersihkan viewfinder container DOM
      if (this.videoElement) {
        const container = document.getElementById(this.elementId);
        if (container && this.videoElement.parentNode === container) {
          container.removeChild(this.videoElement);
        }
        this.videoElement = null;
      }
    } catch (error) {
      console.warn('Gagal mematikan scanner barcode:', error);
    }
  }
}
