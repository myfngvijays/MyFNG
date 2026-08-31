/** Ensure workshop staff are linked to the test workshop. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKSHOP_ID = 'c248e9cc-359f-4131-a4ec-4cd4837dcb54';
const STAFF_EMAILS = [
  'vijayshinde121@gmail.com',
  'projectsinindia2@gmail.com',
  'roadservedigital@gmail.com',
  'myfng10@gmail.com',
  'pronewsinfodata@gmail.com',
  'aman.g@roadserve.in',
];

function loadEnvLocal() {
  const envPath = path.join(__dirname, '../.env.local');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvLocal();
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const { data, error } = await admin
  .from('users_login')
  .update({ workshop_id: WORKSHOP_ID, is_active: true, updated_at: new Date().toISOString() })
  .in('email', STAFF_EMAILS)
  .select('email, full_name, workshop_id, role:roles!role_id(role_code, role_name)');

if (error) {
  console.error(error.message);
  process.exit(1);
}

console.table(
  (data || []).map((r) => ({
    email: r.email,
    name: r.full_name,
    role: r.role?.role_code,
    workshop_id: r.workshop_id,
  })),
);
