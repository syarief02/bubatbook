import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false }});

async function checkRpc() {
  const testId = crypto.randomUUID();
  console.log('Testing RPC with ID:', testId);
  const { data, error } = await supabase.rpc('admin_create_walk_in_customer', {
    p_id: testId,
    p_display_name: 'Test Customer',
    p_ic_number: 'test-ic-' + Date.now(),
    p_phone: '012' + Date.now().toString().slice(-7),
    p_address_line1: 'test-address',
    p_address_line2: null,
    p_city: null,
    p_state: null,
    p_postcode: null,
    p_licence_expiry: '2025-01-01',
    p_ic_file_path: 'test-ic-path',
    p_licence_file_path: 'test-lic-path',
    p_admin_id: '123e4567-e89b-12d3-a456-426614174000',
    p_email: 'testemail-' + Date.now() + '@example.com',
    p_gdl_license: 'GDL'
  });
  
  if (error) {
     console.error('RPC ERROR HAS OCCURRED:', JSON.stringify(error, null, 2));
  } else {
     console.log('RPC check result SUCCESS');
     const { data: profile } = await supabase.from('bubatrent_booking_profiles').select('*').eq('id', testId).single();
     console.log('Saved Profile gdl_license value:', profile?.gdl_license);
  }
}

setTimeout(checkRpc, 500); // delay to let dotenv complete logging
