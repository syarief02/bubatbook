const { Client } = require('pg');

async function run() {
  const client = new Client({
    connectionString: 'postgresql://postgres:Ssy%40rief.1234@db.blqsgijvdvzwnqeltoje.supabase.co:5432/postgres',
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  const { rows } = await client.query(`
    SELECT id, display_name, username, role 
    FROM bubatrent_booking_profiles 
    WHERE display_name ILIKE '%amira%' OR username ILIKE '%amira%';
  `);
  console.log('Amira search results:', rows);

  await client.end();
}
run().catch(console.error);
