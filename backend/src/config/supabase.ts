import { createClient } from '@supabase/supabase-js';

// Backend-only client: the service role key bypasses Storage policies and must never be exposed to browser code.
export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for server-side Storage operations.');
  return createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export const galleryBucket = process.env.SUPABASE_GALLERY_BUCKET || 'gallery';