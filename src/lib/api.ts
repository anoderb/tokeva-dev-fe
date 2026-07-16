const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';

/**
 * Basic Fetch client for TOKIVA AI Backend APIs
 */
async function fetchApi(endpoint: string, options: RequestInit = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tokiva_ai_token') : null;
  
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.message || 'Terjadi kesalahan pada server.');
  }

  return result.data;
}

// Auth APIs
export async function loginDev(password: string): Promise<{ token: string }> {
  return fetchApi('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ password })
  });
}

// Master Produk AI APIs
export interface MasterProductAI {
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

export async function fetchMasterProducts(): Promise<MasterProductAI[]> {
  return fetchApi('/master-produk');
}

export async function createMasterProduct(data: Omit<MasterProductAI, 'id' | 'created_at' | 'updated_at' | 'status'>): Promise<MasterProductAI> {
  return fetchApi('/master-produk', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

export async function updateMasterProduct(id: string, data: Partial<MasterProductAI>): Promise<MasterProductAI> {
  return fetchApi(`/master-produk/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
}

export async function deleteMasterProduct(id: string): Promise<boolean> {
  await fetchApi(`/master-produk/${id}`, {
    method: 'DELETE'
  });
  return true;
}

// Feedback APIs
export interface FeedbackAI {
  id: string;
  img_url: string;
  predicted_label: string;
  confidence: number;
  actual_label: string;
  model_id?: string;
  cashier_name: string;
  timestamp: string;
  status: string;
}

export async function fetchFeedbackQueue(): Promise<FeedbackAI[]> {
  return fetchApi('/feedback/loop');
}

export async function resolveFeedback(id: string, action: 'approve' | 'reject'): Promise<void> {
  return fetchApi(`/feedback/loop/${id}/resolve`, {
    method: 'POST',
    body: JSON.stringify({ action })
  });
}

// Unknown Product APIs
export interface UnknownProduct {
  id: string;
  img_url: string;
  model_id?: string;
  cashier_name: string;
  timestamp: string;
  status: string;
}

export async function fetchUnknownQueue(): Promise<UnknownProduct[]> {
  return fetchApi('/feedback/unknown');
}

export async function resolveUnknownProduct(id: string, action: 'link' | 'delete', masterProductBarcode?: string): Promise<void> {
  return fetchApi(`/feedback/unknown/${id}/resolve`, {
    method: 'POST',
    body: JSON.stringify({ action, masterProductBarcode })
  });
}
