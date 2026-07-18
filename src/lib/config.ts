export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
export const ACCESS_PASSWORD = process.env.NEXT_PUBLIC_ACCESS_PASSWORD || '';
export const SUPABASE_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_BUCKET || 'dataset-photos-dev';

// Hugging Face Credentials
export const HF_TOKEN = process.env.NEXT_PUBLIC_HF_TOKEN || '';

// Raw repo ID from env (e.g. "Anoderb/dataset-collect")
const _rawHfRepo = process.env.NEXT_PUBLIC_HF_REPO || '';

// HF_REPO_ID: clean repo id tanpa prefix, untuk konstruksi URL (e.g. "Anoderb/dataset-collect")
export const HF_REPO_ID = _rawHfRepo.startsWith('datasets/')
  ? _rawHfRepo.slice('datasets/'.length)
  : _rawHfRepo;

// HF_REPO: repo string dengan prefix 'datasets/' untuk @huggingface/hub SDK
export const HF_REPO = _rawHfRepo
  ? (_rawHfRepo.startsWith('datasets/') ? _rawHfRepo : `datasets/${_rawHfRepo}`)
  : '';
