const { Client } = require('pg');
const fs = require('fs');

const c = new Client({
    connectionString: 'postgresql://postgres:Ssy%40rief.1234@db.blqsgijvdvzwnqeltoje.supabase.co:5432/postgres',
    ssl: { rejectUnauthorized: false },
});

(async () => {
    try {
        await c.connect();
        console.log('Connected to Supabase DB!');
        const sql = fs.readFileSync('migrations/add_upload_logs.sql', 'utf8');
        await c.query(sql);
        console.log('Migration completed successfully!');
        const r = await c.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'bubatrent_booking_upload_logs' ORDER BY ordinal_position");
        console.log('Table columns:', JSON.stringify(r.rows, null, 2));
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await c.end();
    }
})();
