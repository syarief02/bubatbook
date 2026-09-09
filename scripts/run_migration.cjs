const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required.');
  process.exit(1);
}

const s = createClient(supabaseUrl, supabaseKey);

(async () => {
  const { data, error } = await s
    .from('bubatrent_booking_upload_logs')
    .select('step, message, metadata, created_at')
    .order('created_at', { ascending: false })
    .limit(11);

  if (error) {
    console.log('ERROR:', error);
    return;
  }

  console.log('=== Upload Logs Test Results ===');
  console.log('Total entries found:', data.length);
  console.log('');

  data.forEach((l, i) => {
    const m = l.metadata || {};
    const device = /mobile|iphone|android/i.test(m.browser || '') ? 'MOBILE' : 'DESKTOP';
    console.log(`${i + 1}. [${l.step.toUpperCase().padEnd(14)}] ${l.message}`);
    console.log(
      `   File: ${m.file_name || 'n/a'} | Size: ${m.file_size ? Math.round(m.file_size / 1024) + 'KB' : 'n/a'} | Device: ${device}`
    );
    console.log('');
  });

  // Count by step
  const steps = {};
  data.forEach((l) => {
    steps[l.step] = (steps[l.step] || 0) + 1;
  });
  console.log('Summary by step:', steps);
})();
