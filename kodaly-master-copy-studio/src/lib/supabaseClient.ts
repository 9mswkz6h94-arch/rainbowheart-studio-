import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[kodaly-studio] Missing Supabase env vars. ' +
      'Copy .env.example → .env and fill in your project credentials.'
  );
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');
