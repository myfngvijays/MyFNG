/**
 * Dev-only: read latest WhatsApp OTP from DB when message delivery fails.
 *
 * Usage:
 *   node scripts/peekWhatsappOtp.mjs --phone 9594294017
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

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
  const args = process.argv.slice(2);
  const phoneIdx = args.indexOf('--phone');
  const phone = phoneIdx >= 0 ? String(args[phoneIdx + 1] || '').replace(/\D/g, '').slice(-10) : null;
  if (!phone) throw new Error('Pass --phone 9594294017');

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env');

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await supabase
    .from('otp_requests')
    .select('id, status, channel, created_at, metadata')
    .eq('phone', phone)
    .eq('channel', 'WHATSAPP')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) throw new Error(error.message);
  if (!data?.length) {
    console.log(`No WhatsApp OTP requests for ${phone}. App mein "Send OTP via WhatsApp" dabao, phir retry.`);
    return;
  }

  console.log(`Latest WhatsApp OTP requests for ${phone}:\n`);
  for (const row of data) {
    const meta = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
    const code = meta.otp_code || '?';
    const expires = meta.expires_at || '?';
    const expired = expires !== '?' && Date.parse(String(expires)) < Date.now();
    console.log(`- ${row.created_at} | status=${row.status} | OTP=${code} | expires=${expires}${expired ? ' (EXPIRED)' : ''}`);
    if (meta.whatsapp_error) console.log(`  whatsapp_error: ${meta.whatsapp_error}`);
  }

  const latestValid = data.find((row) => {
    const meta = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
    const expires = meta.expires_at ? Date.parse(String(meta.expires_at)) : 0;
    return row.status === 'SENT' && meta.otp_code && expires > Date.now();
  });

  if (latestValid) {
    const code = latestValid.metadata?.otp_code;
    console.log(`\n→ Use OTP: ${code} (WhatsApp par na aaye to bhi ye DB wala OTP chalega)`);
  } else {
    console.log('\n→ Koi valid OTP nahi — dubara WhatsApp OTP request karo ya SMS try karo');
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
