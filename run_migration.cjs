// Run database migration using DATABASE_URL from .env.local
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// Load .env.local
const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
    const [key, ...rest] = line.split('=');
    if (key && rest.length) envVars[key.trim()] = rest.join('=').trim();
});

const DATABASE_URL = envVars.DATABASE_URL;
if (!DATABASE_URL) {
    console.error('DATABASE_URL not found in .env.local');
    process.exit(1);
}

// Read migration file
const migrationFile = process.argv[2] || 'migration_overhaul.sql';
const sql = fs.readFileSync(path.join(__dirname, migrationFile), 'utf8');

async function run() {
    const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
    try {
        await client.connect();
        console.log('Connected to database.');
        await client.query(sql);
        console.log('Migration completed successfully!');
    } catch (err) {
        console.error('Migration error:', err.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

run();
