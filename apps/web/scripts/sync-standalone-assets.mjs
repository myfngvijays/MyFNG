/**
 * Next standalone does not include CSS/JS chunks. Copy them after every build
 * so `npm run build` + pm2 reload does not ship unstyled HTML.
 */
import { cpSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const standalone = join(webRoot, '.next/standalone/apps/web');
const fallback = join(webRoot, '.next/standalone');
const destRoot = existsSync(join(standalone, 'server.js'))
  ? standalone
  : existsSync(join(fallback, 'server.js'))
    ? fallback
    : null;

if (!destRoot) {
  console.warn('[sync-standalone-assets] standalone server.js missing — skip');
  process.exit(0);
}

const staticSrc = join(webRoot, '.next/static');
if (!existsSync(staticSrc)) {
  console.warn('[sync-standalone-assets] .next/static missing — skip');
  process.exit(0);
}

mkdirSync(join(destRoot, '.next'), { recursive: true });
cpSync(staticSrc, join(destRoot, '.next/static'), { recursive: true });
console.log('[sync-standalone-assets] copied .next/static');

const publicSrc = join(webRoot, 'public');
if (existsSync(publicSrc)) {
  cpSync(publicSrc, join(destRoot, 'public'), { recursive: true });
  console.log('[sync-standalone-assets] copied public');
}

for (const envfile of ['.env', '.env.local', '.env.production', '.env.production.local']) {
  const from = join(webRoot, envfile);
  if (existsSync(from)) {
    cpSync(from, join(destRoot, envfile));
    console.log(`[sync-standalone-assets] copied ${envfile}`);
  }
}
