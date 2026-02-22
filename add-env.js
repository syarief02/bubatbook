const { execSync } = require('child_process');

try {
    execSync('npx vercel env rm VITE_SUPABASE_URL production -y', { stdio: 'ignore' });
} catch (e) { }

try {
    execSync('npx vercel env rm VITE_SUPABASE_ANON_KEY production -y', { stdio: 'ignore' });
} catch (e) { }

console.log('Adding URL...');
execSync('npx vercel env add VITE_SUPABASE_URL production', {
    input: 'https://blqsgijvdvzwnqeltoje.supabase.co',
    stdio: ['pipe', 'inherit', 'inherit']
});

console.log('Adding KEY...');
execSync('npx vercel env add VITE_SUPABASE_ANON_KEY production', {
    input: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJscXNnaWp2ZHZ6d25xZWx0b2plIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3MTk5MTQsImV4cCI6MjA4NzI5NTkxNH0._sT7gwJizRqR8E0vUMEw8nKH-wUDaWh2snOIlBlR3_A',
    stdio: ['pipe', 'inherit', 'inherit']
});

console.log('Environment variables set in Vercel successfully.');
