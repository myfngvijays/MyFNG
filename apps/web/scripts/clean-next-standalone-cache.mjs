/**
 * VPS/PM2 writes into .next/standalone/.../.next/cache while the site is live.
 * Next standalone assemble then fails: ENOTEMPTY rmdir .../.next/cache
 */
import { rmSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dirs = [
  join(root, '.next/cache'),
  join(root, '.next/standalone/apps/web/.next/cache'),
  join(root, '.next/standalone/.next/cache'),
];

for (const dir of dirs) {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    /* ignore — build will retry if needed */
  }
}
