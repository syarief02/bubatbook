import { createClient, processLock } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Missing Supabase env vars. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local'
  );
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder',
  {
    auth: {
      persistSession: true,
      detectSessionInUrl: true,
      storageKey: 'rent2go-auth',
      // The default lock (navigator.locks) is shared by every rent2go.my tab. On
      // mobile, a backgrounded tab can be frozen while holding it; a new tab then
      // can't start auth (e.g. after the Google redirect) and the app never learns
      // who is signed in. processLock serialises auth work within this tab only.
      lock: processLock,
    },
  }
);
