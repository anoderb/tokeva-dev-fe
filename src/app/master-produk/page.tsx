"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { BarcodeScanner } from '../../lib/barcode_scanner';
import {
  ArrowLeft,
  Search,
  Plus,
  Edit2,
  Trash2,
  Camera,
  RefreshCw,
  Database,
  X,
  Barcode as BarcodeIcon,
  Tag,
  Layers,
  FileText,
  ToggleLeft
} from 'lucide-react';

interface MasterProduct {
  id: string;
  barcode: string;
  nama: string;
  brand?: string;
  kategori?: string;
  deskripsi?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface DatasetHf {
  id: string;
  name: string;
  slug: string;
  photo_count: number;
}

export default function MasterProdukPage() {
  const router = useRouter();
  const [products, setProducts] = useState<MasterProduct[]>([]);
  const [datasets, setDatasets] = useState<DatasetHf[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalMode, setModalMode] = useState<'tambah' | 'edit'>('tambah');
  const [editingId, setEditingId] = useState<string>('');
  const [tampilDialogScan, setTampilDialogScan] = useState<boolean>(false);
  
  // Form fields
  const [barcode, setBarcode] = useState<string>('');
  const [nama, setNama] = useState<string>('');
  const [brand, setBrand] = useState<string>('');
  const [kategori, setKategori] = useState<string>('');
  const [deskripsi, setDeskripsi] = useState<string>('');
  const [status, setStatus] = useState<string>('aktif');

  // Fetch products and matching datasets
  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch Master Products
      const { data: prodData, error: prodErr } = await supabase
        .from('master_produk_ai')
        .select('*')
        .order('created_at', { ascending: false });

      if (prodErr) throw prodErr;

      // Fetch Datasets to map photo counts
      const { data: dsData, error: dsErr } = await supabase
        .from('datasets_hf')
        .select('id, name, slug, photo_count');

      if (dsErr) throw dsErr;

      setProducts(prodData || []);
      setDatasets(dsData || []);
    } catch (err) {
      console.error("Gagal mengambil data master produk:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Web Audio API beep sound
  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0.04, audioCtx.currentTime);
      oscillator.start();
      setTimeout(() => {
        oscillator.stop();
        audioCtx.close();
      }, 150);
    } catch (e) {
      console.error('Audio play failed:', e);
    }
  };

  // Barcode Scanner logic
  useEffect(() => {
    let scannerInstance: BarcodeScanner | null = null;

    if (tampilDialogScan) {
      const startScanner = async () => {
        try {
          // Allow some time for container to render in DOM
          await new Promise((resolve) => setTimeout(resolve, 300));
          
          scannerInstance = new BarcodeScanner('barcode-viewfinder');
          await scannerInstance.start(
            (decodedText) => {
              playBeep();
              setBarcode(decodedText);
              setTampilDialogScan(false);
            },
            () => {
              // silent error frame by frame
            }
          );
        } catch (err) {
          console.error('Failed to start barcode scanner:', err);
        }
      };

      startScanner();
    }

    return () => {
      if (scannerInstance) {
        scannerInstance.stop();
      }
    };
  }, [tampilDialogScan]);

  const handleOpenAddModal = () => {
    setBarcode('');
    setNama('');
    setBrand('');
    setKategori('');
    setDeskripsi('');
    setStatus('aktif');
    setModalMode('tambah');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (product: MasterProduct) => {
    setEditingId(product.id);
    setBarcode(product.barcode);
    setNama(product.nama);
    setBrand(product.brand || '');
    setKategori(product.kategori || '');
    setDeskripsi(product.deskripsi || '');
    setStatus(product.status);
    setModalMode('edit');
    setIsModalOpen(true);
  };

  const generateSlug = (text: string) => {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcode.trim() || !nama.trim()) return;

    try {
      const slug = generateSlug(nama);

      if (modalMode === 'tambah') {
        // 1. Tambah ke master_produk_ai
        const { data: newProd, error: prodErr } = await supabase
          .from('master_produk_ai')
          .insert([{
            barcode,
            nama,
            brand,
            kategori,
            deskripsi,
            status
          }])
          .select()
          .single();

        if (prodErr) throw prodErr;

        // 2. Tambah ke datasets_hf jika belum ada untuk camera collection
        const { data: existingDs } = await supabase
          .from('datasets_hf')
          .select('id')
          .eq('slug', slug)
          .maybeSingle();

        if (!existingDs) {
          await supabase
            .from('datasets_hf')
            .insert([{ name: nama, slug }]);
        }

        setProducts((prev) => [newProd, ...prev]);
      } else {
        // Edit produk
        const { data: updatedProd, error: prodErr } = await supabase
          .from('master_produk_ai')
          .update({
            barcode,
            nama,
            brand,
            kategori,
            deskripsi,
            status,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingId)
          .select()
          .single();

        if (prodErr) throw prodErr;

        // Opsional update dataset name jika nama produk berubah
        const oldProduct = products.find(p => p.id === editingId);
        if (oldProduct && oldProduct.nama !== nama) {
          const oldSlug = generateSlug(oldProduct.nama);
          await supabase
            .from('datasets_hf')
            .update({ name: nama, slug })
            .eq('slug', oldSlug);
        }

        setProducts((prev) =>
          prev.map((p) => (p.id === editingId ? updatedProd : p))
        );
      }
      
      setIsModalOpen(false);
      fetchData(); // Refresh counts
    } catch (err: any) {
      console.error("Gagal menyimpan produk:", err);
      alert(`Gagal menyimpan produk: ${err.message}`);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Apakah Anda yakin ingin menghapus produk "${name}"?\nData master SKU akan dihapus permanen.`)) {
      try {
        const { error } = await supabase
          .from('master_produk_ai')
          .delete()
          .eq('id', id);

        if (error) throw error;

        // Opsional hapus dataset_hf
        const slug = generateSlug(name);
        await supabase.from('datasets_hf').delete().eq('slug', slug);

        setProducts((prev) => prev.filter((p) => p.id !== id));
      } catch (err: any) {
        console.error("Gagal menghapus produk:", err);
        alert(`Gagal menghapus produk: ${err.message}`);
      }
    }
  };

  // Filter products by search query
  const filteredProducts = products.filter((p) =>
    p.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.barcode.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.brand && p.brand.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (p.kategori && p.kategori.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Helper to find camera collection link for a product
  const getCameraLink = (productName: string) => {
    const slug = generateSlug(productName);
    const matchingDataset = datasets.find(d => d.slug === slug);
    if (matchingDataset) {
      return `/dataset/collect?id=${matchingDataset.id}&slug=${matchingDataset.slug}&name=${encodeURIComponent(matchingDataset.name)}`;
    }
    return null;
  };

  const getPhotoCount = (productName: string) => {
    const slug = generateSlug(productName);
    const matchingDataset = datasets.find(d => d.slug === slug);
    return matchingDataset ? matchingDataset.photo_count : 0;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 flex flex-col justify-start items-center">
      <div className="w-full max-w-5xl space-y-8">
        
        {/* Header Back Button */}
        <div className="flex items-center justify-between border-b border-slate-900 pb-6">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.push('/')}
              className="p-2 hover:bg-slate-900 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Master Produk AI</h1>
              <p className="text-xs text-slate-500 mt-1">Daftar kelas SKU produk yang dilatih & dikenali sistem POS</p>
            </div>
          </div>

          <button
            onClick={handleOpenAddModal}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg flex items-center space-x-2 text-xs shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah SKU</span>
          </button>
        </div>

        {/* Search controls */}
        <div className="relative w-full max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Cari barcode, nama produk, brand, atau kategori..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900/40 border border-slate-900 focus:border-slate-800 rounded-xl text-xs placeholder:text-slate-500 focus:outline-none transition-colors"
          />
        </div>

        {/* Content Table Area */}
        <div className="bg-slate-900/10 border border-slate-900 rounded-2xl overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
              <RefreshCw className="w-8 h-8 animate-spin mb-3 text-blue-500" />
              <span className="text-xs">Memuat daftar master produk...</span>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500 text-center">
              <Database className="w-10 h-10 mb-3 opacity-30 text-blue-400" />
              <p className="text-sm font-semibold text-slate-400">Tidak ada produk ditemukan</p>
              <p className="text-xs mt-1">Gunakan tombol "Tambah SKU" di kanan atas untuk mendaftarkan.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-900 bg-slate-950/20 text-slate-400 font-semibold">
                    <th className="px-6 py-4">No</th>
                    <th className="px-6 py-4">Barcode</th>
                    <th className="px-6 py-4">Nama SKU Produk</th>
                    <th className="px-6 py-4">Brand</th>
                    <th className="px-6 py-4">Kategori</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Foto Dataset</th>
                    <th className="px-6 py-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900/50">
                  {filteredProducts.map((product, idx) => {
                    const cameraUrl = getCameraLink(product.nama);
                    const photoCount = getPhotoCount(product.nama);
                    
                    return (
                      <tr key={product.id} className="hover:bg-slate-900/10 transition-colors">
                        <td className="px-6 py-4 font-mono text-slate-500">{idx + 1}</td>
                        <td className="px-6 py-4 font-mono text-slate-350">{product.barcode}</td>
                        <td className="px-6 py-4 font-semibold text-slate-200">{product.nama}</td>
                        <td className="px-6 py-4 text-slate-400">{product.brand || '-'}</td>
                        <td className="px-6 py-4 text-slate-400">{product.kategori || '-'}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            product.status === 'aktif'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : 'bg-slate-800 text-slate-500 border-slate-800'
                          }`}>
                            {product.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2.5 py-0.5 font-bold rounded-full bg-slate-800 text-slate-400">
                            {photoCount} foto
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right flex items-center justify-end space-x-1.5">
                          {/* Camera link */}
                          {cameraUrl ? (
                            <Link
                              href={cameraUrl}
                              className="p-2 text-emerald-400 bg-slate-800/40 hover:bg-slate-800 hover:text-emerald-300 rounded-lg transition-colors"
                              title="Ambil Dataset Foto"
                            >
                              <Camera className="w-4 h-4" />
                            </Link>
                          ) : (
                            <button
                              disabled
                              className="p-2 text-slate-650 bg-slate-900 rounded-lg cursor-not-allowed"
                              title="Dataset belum siap"
                            >
                              <Camera className="w-4 h-4" />
                            </button>
                          )}
                          
                          {/* Edit button */}
                          <button
                            onClick={() => handleOpenEditModal(product)}
                            className="p-2 text-blue-400 bg-slate-800/40 hover:bg-slate-800 hover:text-blue-300 rounded-lg transition-colors"
                            title="Ubah Produk"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          
                          {/* Delete button */}
                          <button
                            onClick={() => handleDelete(product.id, product.nama)}
                            className="p-2 text-red-400 bg-slate-800/40 hover:bg-slate-800 hover:text-red-300 rounded-lg transition-colors"
                            title="Hapus"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

      {/* CRUD Overlay Dialog Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-900 bg-slate-900 p-6 shadow-2xl flex flex-col space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-850 pb-3">
              <h3 className="font-bold text-slate-100 text-base">
                {modalMode === 'tambah' ? 'Tambah Master Produk AI' : 'Ubah SKU Master'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Barcode */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500 flex items-center">
                  <BarcodeIcon className="w-3 h-3 mr-1" />
                  <span>Barcode (Unique SKU ID)</span>
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    placeholder="Contoh: 8991234567890"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    className="flex-1 px-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none transition-colors"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setTampilDialogScan(true)}
                    className="px-3.5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all active:scale-95 flex items-center justify-center shrink-0"
                    title="Scan Barcode dengan Kamera"
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Nama Produk */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500 flex items-center">
                  <Tag className="w-3 h-3 mr-1" />
                  <span>Nama Produk</span>
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Susu Ultra Milk Cokelat 250ml"
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none transition-colors"
                  required
                />
              </div>

              {/* Brand & Kategori */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500 flex items-center">
                    <Database className="w-3 h-3 mr-1" />
                    <span>Brand / Merk</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Ultra Jaya"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500 flex items-center">
                    <Layers className="w-3 h-3 mr-1" />
                    <span>Kategori</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Minuman"
                    value={kategori}
                    onChange={(e) => setKategori(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Deskripsi */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500 flex items-center">
                  <FileText className="w-3 h-3 mr-1" />
                  <span>Deskripsi SKU</span>
                </label>
                <textarea
                  placeholder="Keterangan tambahan produk..."
                  value={deskripsi}
                  onChange={(e) => setDeskripsi(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none transition-colors resize-none"
                />
              </div>

              {/* Status */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500 flex items-center">
                  <ToggleLeft className="w-3.5 h-3.5 mr-1" />
                  <span>Status Produk</span>
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none transition-colors"
                >
                  <option value="aktif">Aktif (Dikenali POS & Terbuka Koleksi)</option>
                  <option value="nonaktif">Nonaktif (Dikecualikan)</option>
                </select>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3 pt-3 border-t border-slate-850">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs font-semibold rounded-xl transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-500/10 transition-colors"
                >
                  Simpan SKU
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Barcode Camera Scanner Overlay */}
      {tampilDialogScan && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/90 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl flex flex-col space-y-4 items-center">
            <div className="flex items-center justify-between w-full border-b border-slate-850 pb-3">
              <h3 className="font-bold text-slate-100 text-sm">Scan Barcode Produk</h3>
              <button
                onClick={() => setTampilDialogScan(false)}
                className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-black border border-slate-800">
              {/* Viewfinder container */}
              <div id="barcode-viewfinder" className="w-full h-full object-cover" />
              
              {/* Laser scanner effect */}
              <div className="absolute inset-x-0 top-1/2 h-[2px] bg-red-500 shadow-[0_0_8px_#ef4444] animate-pulse" />
            </div>

            <p className="text-[10px] text-slate-500 text-center leading-relaxed max-w-[280px]">
              Arahkan barcode produk ke dalam kamera. Kamera akan mendeteksi tipe EAN-13, EAN-8, Code-128, dan QR Code secara otomatis.
            </p>

            <button
              onClick={() => setTampilDialogScan(false)}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-350 text-xs font-semibold rounded-xl transition-colors"
            >
              Tutup Kamera
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
