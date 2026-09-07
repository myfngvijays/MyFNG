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

const mcpDist = join(webRoot, '../../packages/myfng-mcp/dist');
if (existsSync(join(mcpDist, 'createServer.js'))) {
  const standaloneMcp = join(destRoot, 'packages/myfng-mcp/dist');
  mkdirSync(standaloneMcp, { recursive: true });
  cpSync(mcpDist, standaloneMcp, { recursive: true });
  const tracedMcp = join(destRoot, '../../packages/myfng-mcp/dist');
  mkdirSync(tracedMcp, { recursive: true });
  cpSync(mcpDist, tracedMcp, { recursive: true });
  const mcpNm = join(destRoot, 'packages/myfng-mcp/node_modules');
  mkdirSync(mcpNm, { recursive: true });
  for (const dep of ['zod', '@supabase/supabase-js']) {
    const from = join(webRoot, 'node_modules', dep);
    if (!existsSync(from)) continue;
    const to = join(mcpNm, dep);
    mkdirSync(dirname(to), { recursive: true });
    cpSync(from, to, { recursive: true });
  }
  console.log('[sync-standalone-assets] copied packages/myfng-mcp/dist + zod/supabase');
}

for (const envfile of ['.env', '.env.local', '.env.production', '.env.production.local']) {
  const from = join(webRoot, envfile);
  if (existsSync(from)) {
    cpSync(from, join(destRoot, envfile));
    console.log(`[sync-standalone-assets] copied ${envfile}`);
  }
}
