const { Client } = require('pg');

async function run() {
    const client = new Client({
        connectionString: 'postgresql://postgres:Ssy%40rief.1234@db.blqsgijvdvzwnqeltoje.supabase.co:5432/postgres',
        ssl: { rejectUnauthorized: false }
    });
    await client.connect();
    console.log('Connected\n');

    // 1. Check ALL RLS policies on all bubatrent tables
    console.log('=== ALL BUBATRENT TABLE POLICIES ===');
    const allPolicies = await client.query(`
    SELECT schemaname, tablename, policyname, cmd, permissive, roles, qual, with_check 
    FROM pg_policies 
    WHERE tablename LIKE 'bubatrent_%' 
    ORDER BY tablename, cmd
  `);
    let currentTable = '';
    allPolicies.rows.forEach(p => {
        if (p.tablename !== currentTable) {
            currentTable = p.tablename;
            console.log(`\n[${p.tablename}]`);
        }
        console.log(`  [${p.cmd}] ${p.policyname} (${p.permissive}) roles=${JSON.stringify(p.roles)}`);
        if (p.qual) console.log(`    USING: ${p.qual.substring(0, 120)}`);
        if (p.with_check) console.log(`    WITH CHECK: ${p.with_check.substring(0, 120)}`);
    });

    // 2. Check if RLS is enabled on each table
    console.log('\n\n=== RLS ENABLED STATUS ===');
    const rlsStatus = await client.query(`
    SELECT c.relname as table_name, c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname LIKE 'bubatrent_%' AND c.relkind = 'r'
    ORDER BY c.relname
  `);
    rlsStatus.rows.forEach(t => {
        console.log(`  ${t.table_name}: RLS=${t.rls_enabled ? 'ON' : 'OFF'} Force=${t.rls_forced ? 'YES' : 'NO'}`);
    });

    // 3. Check storage policies
    console.log('\n\n=== STORAGE OBJECT POLICIES ===');
    const storagePolicies = await client.query(`
    SELECT policyname, cmd, permissive, roles, qual, with_check
    FROM pg_policies 
    WHERE tablename = 'objects' AND schemaname = 'storage'
    ORDER BY cmd
  `);
    storagePolicies.rows.forEach(p => {
        console.log(`  [${p.cmd}] ${p.policyname} (${p.permissive})`);
        if (p.qual) console.log(`    USING: ${p.qual.substring(0, 150)}`);
        if (p.with_check) console.log(`    WITH CHECK: ${p.with_check.substring(0, 150)}`);
    });

    // 4. Check if change_requests table exists
    console.log('\n\n=== TABLE EXISTENCE CHECK ===');
    const tables = await client.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name LIKE 'bubatrent_%'
    ORDER BY table_name
  `);
    tables.rows.forEach(t => console.log(`  ${t.table_name}`));

    // 5. Check storage buckets
    console.log('\n\n=== STORAGE BUCKETS ===');
    const buckets = await client.query('SELECT id, name, public, file_size_limit FROM storage.buckets');
    buckets.rows.forEach(b => console.log(`  ${b.id}: public=${b.public} limit=${b.file_size_limit}`));

    await client.end();
    console.log('\nDone!');
}

run().catch(e => console.error('Error:', e.message));
