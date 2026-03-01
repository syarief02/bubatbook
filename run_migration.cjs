const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function run() {
    const c = new Client('postgresql://postgres:Ssy%40rief.1234@db.blqsgijvdvzwnqeltoje.supabase.co:5432/postgres');
    await c.connect();

    const sql = fs.readFileSync(path.join(__dirname, 'migrations', 'add_fleet_groups.sql'), 'utf8');

    try {
        await c.query(sql);
        console.log('✓ Migration completed successfully');
    } catch (err) {
        console.error('✗ Migration failed:', err.message);
        console.error('Detail:', err.detail || 'none');
    }

    // Verify
    try {
        const { rows: fg } = await c.query('SELECT id, name, slug FROM bubatrent_booking_fleet_groups');
        console.log('\nFleet groups:', fg);

        const { rows: fm } = await c.query('SELECT user_id, fleet_group_id, role FROM bubatrent_booking_fleet_memberships');
        console.log('Fleet memberships:', fm);

        const { rows: cars } = await c.query("SELECT COUNT(*) as c FROM bubatrent_booking_cars WHERE fleet_group_id IS NOT NULL");
        console.log('Cars with fleet:', cars[0].c);

        const { rows: bookings } = await c.query("SELECT COUNT(*) as c FROM bubatrent_booking_bookings WHERE fleet_group_id IS NOT NULL");
        console.log('Bookings with fleet:', bookings[0].c);
    } catch (err) {
        console.error('Verify failed:', err.message);
    }

    await c.end();
}

run().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
