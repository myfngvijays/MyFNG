import { readFileSync } from 'fs';
import path from 'path';

function loadEnv() {
  const raw = readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

async function main() {
  loadEnv();
  const secret = process.env.CRON_SECRET || process.env.NOTIFICATION_CRON_SECRET;
  if (!secret) throw new Error('CRON secret missing');
  const res = await fetch('http://localhost:3000/api/cron/daily-blog?force=1', {
    headers: { Authorization: `Bearer ${secret}` },
  });
  const body = await res.json().catch(() => ({}));
  console.log(JSON.stringify({
    status: res.status,
    success: body.success || false,
    skipped: body.skipped || false,
    title: body.title || null,
    slug: body.slug || null,
    topic: body.topic || null,
    error: body.error || null,
  }));
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
