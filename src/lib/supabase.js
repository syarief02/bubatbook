import { createClient } from '@supabase/supabase-js';

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
                        // No-op lock: bypass Navigator LockManager to prevent timeout errors
                        lock: async (_name, _acquireTimeout, fn) => await fn(),
                },
        }
);
