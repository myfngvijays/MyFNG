/**
 * Next standalone does not include CSS/JS chunks. Copy them after every build
 * so `npm run build` + pm2 reload does not ship unstyled HTML.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
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

function copyDirSafe(from, to, label) {
  try {
    if (!existsSync(from)) return false;
    mkdirSync(dirname(to), { recursive: true });
    cpSync(from, to, { recursive: true, dereference: true });
    if (label) console.log(`[sync-standalone-assets] copied ${label}`);
    return true;
  } catch (err) {
    console.warn(`[sync-standalone-assets] skip ${label || to}: ${err.message}`);
    return false;
  }
}

function injectPrettyHtml(dest) {
  const formatSrc = join(webRoot, 'scripts/format-html.js');
  const patchSrc = join(webRoot, 'scripts/html-pretty-patch.js');
  const serverJs = join(dest, 'server.js');
  if (!existsSync(formatSrc) || !existsSync(patchSrc) || !existsSync(serverJs)) {
    console.warn('[sync-standalone-assets] pretty HTML files missing — skip inject');
    return;
  }

  cpSync(formatSrc, join(dest, 'format-html.js'));
  cpSync(patchSrc, join(dest, 'html-pretty-patch.js'));

  const marker = "require('./html-pretty-patch.js')";
  const source = readFileSync(serverJs, 'utf8');
  if (source.includes('html-pretty-patch')) {
    console.log('[sync-standalone-assets] pretty HTML already in standalone server.js');
    return;
  }

  writeFileSync(serverJs, `${marker};\n${source}`);
  console.log('[sync-standalone-assets] injected pretty HTML into standalone server.js');
}

// Pretty HTML first so later optional copies cannot block view-source.
injectPrettyHtml(destRoot);

const staticSrc = join(webRoot, '.next/static');
if (existsSync(staticSrc)) {
  mkdirSync(join(destRoot, '.next'), { recursive: true });
  copyDirSafe(staticSrc, join(destRoot, '.next/static'), '.next/static');
} else {
  console.warn('[sync-standalone-assets] .next/static missing — skip');
}

copyDirSafe(join(webRoot, 'public'), join(destRoot, 'public'), 'public');

const mcpDist = join(webRoot, '../../packages/myfng-mcp/dist');
if (existsSync(join(mcpDist, 'createServer.js'))) {
  copyDirSafe(mcpDist, join(destRoot, 'packages/myfng-mcp/dist'), 'packages/myfng-mcp/dist');
  copyDirSafe(mcpDist, join(destRoot, '../../packages/myfng-mcp/dist'), 'traced myfng-mcp/dist');
  const mcpNm = join(destRoot, 'packages/myfng-mcp/node_modules');
  mkdirSync(mcpNm, { recursive: true });
  for (const dep of ['zod', '@supabase/supabase-js']) {
    copyDirSafe(join(webRoot, 'node_modules', dep), join(mcpNm, dep), `mcp ${dep}`);
  }
}

for (const envfile of ['.env', '.env.local', '.env.production', '.env.production.local']) {
  const from = join(webRoot, envfile);
  if (existsSync(from)) {
    try {
      cpSync(from, join(destRoot, envfile));
      console.log(`[sync-standalone-assets] copied ${envfile}`);
    } catch (err) {
      console.warn(`[sync-standalone-assets] skip ${envfile}: ${err.message}`);
    }
  }
}
