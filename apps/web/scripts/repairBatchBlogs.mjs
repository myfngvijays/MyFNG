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

const BASE = process.env.BATCH_BLOG_URL || 'http://localhost:3000';

async function call(secret, qs) {
  const url = `${BASE.replace(/\/$/, '')}/api/cron/batch-blogs?${qs}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${secret}` } });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function main() {
  loadEnv();
  const secret = process.env.CRON_SECRET || process.env.NOTIFICATION_CRON_SECRET;
  if (!secret) throw new Error('CRON secret missing');

  const results = [];
  for (let offset = 0; offset < 80; offset += 1) {
    let attempt = await call(secret, `refresh_covers=1&offset=${offset}`);
    if (!attempt.body?.success) {
      await new Promise((r) => setTimeout(r, 800));
      attempt = await call(secret, `refresh_covers=1&offset=${offset}`);
    }
    if (attempt.body?.reason === 'done') break;
    const row = {
      offset,
      ok: Boolean(attempt.body?.success),
      title: attempt.body?.title || null,
      slug: attempt.body?.slug || null,
      cover: attempt.body?.cover_key || null,
      error: attempt.body?.error || null,
    };
    results.push(row);
    console.log(JSON.stringify(row));
  }

  const failed = results.filter((r) => !r.ok);
  console.log(JSON.stringify({
    done: true,
    refreshed: results.filter((r) => r.ok).length,
    failed: failed.length,
    failed_rows: failed,
  }, null, 2));
  if (failed.length) process.exit(1);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
