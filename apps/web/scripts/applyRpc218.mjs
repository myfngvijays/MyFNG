/**
 * Apply database/218_register_customer_fcm_token_rpc.sql to Supabase.
 * Requires SUPABASE_DB_URL (postgres connection string from Supabase dashboard).
 *
 * Usage:
 *   SUPABASE_DB_URL='postgresql://postgres.[ref]:[password]@...' node scripts/applyRpc218.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnvLocal() {
  const envPath = path.join(__dirname, '../.env.local');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i <= 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}

async function main() {
  loadEnvLocal();
  const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('Missing SUPABASE_DB_URL — get it from Supabase → Project Settings → Database → Connection string');
    console.error('Then run: SUPABASE_DB_URL="postgresql://..." node scripts/applyRpc218.mjs');
    process.exit(1);
  }

  const sqlPath = path.join(__dirname, '../../database/218_register_customer_fcm_token_rpc.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  let pg;
  try {
    pg = (await import('pg')).default;
  } catch {
    console.error('Install pg first: npm install pg --save-dev');
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(sql);
    console.log('✓ Applied 218_register_customer_fcm_token_rpc.sql');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
