import { createClient } from '@supabase/supabase-js';

// Browser client uses only the anon key. Never expose the Supabase service role key in frontend code.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string
);

export const GALLERY_BUCKET = import.meta.env.VITE_SUPABASE_GALLERY_BUCKET || 'gallery';