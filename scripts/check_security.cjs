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
    'bubatrent_booking_rental_changes',
    'bubatrent_booking_car_documents',
    'bubatrent_booking_records',
    'bubatrent_booking_admin_contacts',
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

  const { error: carDocErr } = await anon.rpc('bubatrent_admin_add_car_document', {
    p_id: '00000000-0000-0000-0000-000000000000',
    p_car_id: '00000000-0000-0000-0000-000000000000',
    p_doc_type: 'road_tax',
    p_valid_from: null,
    p_valid_until: '2099-01-01',
    p_amount: null,
    p_provider: null,
    p_reference: null,
    p_file_paths: ['car-documents/00000000-0000-0000-0000-000000000000/x.pdf'],
  });
  report(!!carDocErr, 'anon cannot record car documents', carDocErr ? 'denied' : 'allowed');

  const { error: waErr } = await anon.rpc('bubatrent_admin_set_my_whatsapp', {
    p_whatsapp: '60123456789',
  });
  report(!!waErr, 'anon cannot save a WhatsApp number', waErr ? 'denied' : 'allowed');

  const { error: contactsErr } = await anon.rpc('bubatrent_fleet_contacts', {
    p_fleet_group_id: '00000000-0000-0000-0000-000000000000',
  });
  report(!!contactsErr, 'anon cannot list fleet contacts', contactsErr ? 'denied' : 'allowed');

  for (const [fn, args] of [
    [
      'bubatrent_admin_record_rental',
      {
        p_id: '00000000-0000-0000-0000-000000000000',
        p_car_id: '00000000-0000-0000-0000-000000000000',
        p_status: 'RETURNED',
        p_pickup: '2025-01-01',
        p_return: '2025-01-02',
      },
    ],
    [
      'bubatrent_admin_record_rent_payment',
      { p_booking_id: '00000000-0000-0000-0000-000000000000', p_amount: 1 },
    ],
    ['bubatrent_admin_deposit_refunded', { p_booking_id: '00000000-0000-0000-0000-000000000000' }],
  ]) {
    const { error } = await anon.rpc(fn, args);
    report(!!error, `anon cannot call ${fn}`, error ? 'denied' : 'allowed');
  }

  const { error: otherErr } = await anon.rpc('bubatrent_admin_other_fleet_rentals', {
    p_fleet_group_id: null,
  });
  report(!!otherErr, 'anon cannot list rentals', otherErr ? 'denied' : 'allowed');

  for (const [fn, args] of [
    ['bubatrent_admin_extend_rental', { p_new_return: '2099-01-01' }],
    ['bubatrent_admin_end_rental_early', { p_new_return: '2099-01-01', p_reason: 'customer' }],
    ['bubatrent_admin_change_rental_price', { p_new_total: 1, p_note: 'x' }],
    ['bubatrent_admin_replace_car', { p_car_id: '00000000-0000-0000-0000-000000000000' }],
  ]) {
    const { error } = await anon.rpc(fn, {
      p_booking_id: '00000000-0000-0000-0000-000000000000',
      ...args,
    });
    report(!!error, `anon cannot call ${fn}`, error ? 'denied' : 'allowed');
  }

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

  const { error: carContactErr } = await anon.rpc('bubatrent_car_contact', {
    p_car_id: '00000000-0000-0000-0000-000000000000',
  });
  report(
    !carContactErr,
    'car WhatsApp contact works for visitors',
    carContactErr ? `error: ${carContactErr.message}` : 'ok'
  );

  console.log(failed ? `\n${failed} check(s) failed` : '\nAll checks passed');
  process.exit(failed ? 1 : 0);
})();
