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

const TOTAL = Number(process.env.BATCH_TOTAL || 50);
const FROM = Number(process.env.BATCH_FROM || 0);
const BASE = process.env.BATCH_BLOG_URL || 'http://localhost:3000';

async function postOne(secret, index) {
  const url = `${BASE.replace(/\/$/, '')}/api/cron/batch-blogs?index=${index}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function main() {
  loadEnv();
  const secret = process.env.CRON_SECRET || process.env.NOTIFICATION_CRON_SECRET;
  if (!secret) throw new Error('CRON secret missing');

  const results = [];
  for (let i = FROM; i < FROM + TOTAL && i < 50; i += 1) {
    let attempt = await postOne(secret, i);
    if (!attempt.body?.success) {
      await new Promise((r) => setTimeout(r, 2500));
      attempt = await postOne(secret, i);
    }
    const row = {
      index: i,
      ok: Boolean(attempt.body?.success),
      skipped: Boolean(attempt.body?.skipped),
      title: attempt.body?.title || null,
      slug: attempt.body?.slug || null,
      cover: attempt.body?.cover_key || null,
      error: attempt.body?.error || null,
      status: attempt.status,
    };
    results.push(row);
    console.log(JSON.stringify(row));
    await new Promise((r) => setTimeout(r, 800));
  }

  const ok = results.filter((r) => r.ok).length;
  const skipped = results.filter((r) => r.skipped).length;
  const failed = results.filter((r) => !r.ok);
  console.log(JSON.stringify({ done: true, ok, skipped, failed: failed.length, failed_rows: failed }, null, 2));
  if (failed.length) process.exit(1);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
