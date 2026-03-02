const { Client } = require('pg');

async function run() {
    const client = new Client({
        connectionString: 'postgresql://postgres:Ssy%40rief.1234@db.blqsgijvdvzwnqeltoje.supabase.co:5432/postgres',
        ssl: { rejectUnauthorized: false }
    });
    await client.connect();

    const { rows } = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'bubatrent_booking_profiles';
  `);
    console.log('Columns in bubatrent_booking_profiles:', rows.map(r => r.column_name).join(', '));

    await client.end();
}
run().catch(console.error);
