// Checks what an anonymous visitor can reach with the public anon key.
// Run after any database or storage change:  npm run check:security
// Prints counts only, never row contents. Exits 1 if anything is exposed.
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local', quiet: true });

const url = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
if (!url || !anonKey) {
  console.error('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local');
  process.exit(1);
}

const anon = createClient(url, anonKey, { auth: { persistSession: false } });
let failed = 0;

function report(ok, name, detail) {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} — ${detail}`);
}

(async () => {
  const privateTables = [
    'bubatrent_booking_profiles',
    'bubatrent_booking_bookings',
    'bubatrent_booking_payments',
    'bubatrent_booking_credit_transactions',
    'bubatrent_booking_customer_documents',
    'bubatrent_booking_verification_updates',
    'bubatrent_booking_audit_logs',
    'bubatrent_booking_upload_logs',
    'bubatrent_booking_rental_agreements',
    'bubatrent_booking_change_requests',
    'bubatrent_booking_expense_claims',
    'bubatrent_booking_expense_images',
    'bubatrent_booking_fleet_memberships',
    'bubatrent_booking_link_attempts',
    'bubatrent_booking_charges',
    'bubatrent_booking_workshop_payments',
  ];
  for (const table of privateTables) {
    const { count, error } = await anon.from(table).select('*', { count: 'exact', head: true });
    const visible = error ? 0 : count || 0;
    report(
      visible === 0,
      `anon cannot read ${table}`,
      error ? 'denied' : `visible rows: ${visible}`
    );
  }

  const { data: files, error: listErr } = await anon.storage
    .from('customer-documents')
    .list('', { limit: 100 });
  const listed = listErr ? 0 : (files || []).length;
  report(
    listed === 0,
    'anon cannot list customer documents',
    listErr ? 'denied' : `listed: ${listed}`
  );

  const { error: holdErr } = await anon.rpc('bubatrent_create_hold_booking', {
    p_car_id: '00000000-0000-0000-0000-000000000000',
    p_pickup: '2099-01-01',
    p_return: '2099-01-02',
  });
  report(!!holdErr, 'anon cannot create bookings', holdErr ? 'denied' : 'allowed');

  const { error: verifyErr } = await anon.rpc('bubatrent_admin_verify_deposit', {
    p_booking_id: '00000000-0000-0000-0000-000000000000',
  });
  report(!!verifyErr, 'anon cannot verify deposits', verifyErr ? 'denied' : 'allowed');

  const { error: creditErr } = await anon.rpc('bubatrent_admin_adjust_credit', {
    p_user_id: '00000000-0000-0000-0000-000000000000',
    p_amount: 1,
  });
  report(!!creditErr, 'anon cannot change credit', creditErr ? 'denied' : 'allowed');

  const { error: counterErr } = await anon.rpc('bubatrent_admin_create_booking', {
    p_customer_id: '00000000-0000-0000-0000-000000000000',
    p_car_id: '00000000-0000-0000-0000-000000000000',
    p_pickup: '2099-01-01',
    p_return: '2099-01-02',
    p_deposit: 100,
    p_status: 'CONFIRMED',
  });
  report(!!counterErr, 'anon cannot create counter bookings', counterErr ? 'denied' : 'allowed');

  const { error: signErr } = await anon.rpc('bubatrent_sign_rental_agreement', {
    p_booking_id: '00000000-0000-0000-0000-000000000000',
    p_signature_data: 'data:image/png;base64,AAAA',
  });
  report(!!signErr, 'anon cannot sign agreements', signErr ? 'denied' : 'allowed');

  const { error: workshopErr } = await anon.rpc('bubatrent_admin_record_workshop_payment', {
    p_booking_id: '00000000-0000-0000-0000-000000000000',
    p_claim_id: '00000000-0000-0000-0000-000000000000',
    p_workshop: 'x',
    p_description: 'x',
    p_paid_on: '2000-01-01',
    p_amount: 1,
    p_file_paths: [],
  });
  report(!!workshopErr, 'anon cannot record workshop payments', workshopErr ? 'denied' : 'allowed');

  const { data: available, error: availErr } = await anon.rpc('bubatrent_check_availability', {
    p_car_id: '00000000-0000-0000-0000-000000000000',
    p_pickup: '2099-01-01',
    p_return: '2099-01-02',
  });
  report(
    !availErr && typeof available === 'boolean',
    'availability check works for visitors',
    availErr ? `error: ${availErr.message}` : `returned ${available}`
  );

  console.log(failed ? `\n${failed} check(s) failed` : '\nAll checks passed');
  process.exit(failed ? 1 : 0);
})();
