/**
 * Send a live Follow-up Bot demo message to a phone.
 *
 * Usage:
 *   npx tsx scripts/triggerFollowupByPhone.ts 9167456023
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { triggerManualFollowupForPhone } from '../src/lib/whatsappAgents/followup/handler';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnvLocal() {
  const envPath = path.join(__dirname, '../.env.local');
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, 'utf8');
  for (const line of raw.split('\n')) {
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

const phone = String(process.argv[2] || '9167456023').replace(/\D/g, '').slice(-10);
if (phone.length !== 10) {
  console.error('Usage: npx tsx scripts/triggerFollowupByPhone.ts <10-digit-phone>');
  process.exit(1);
}

async function main() {
  const result = await triggerManualFollowupForPhone({
    phone,
    reason: 'Car service follow-up check-in demo',
    force: true,
    ignoreAssigned: true,
  });

  console.log(JSON.stringify({ phone, ...result }, null, 2));
  process.exit(result.handled ? 0 : 1);
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
