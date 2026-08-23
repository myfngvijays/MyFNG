#!/usr/bin/env node
/**
 * Start MyFNG MCP with env loaded from apps/web/.env.local
 * (so mcp.json does not need the service-role key).
 */
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(here, '..');
const repoRoot = join(pkgRoot, '..', '..');
const envLocal = join(repoRoot, 'apps', 'web', '.env.local');
const entry = join(pkgRoot, 'dist', 'index.js');

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  const text = readFileSync(path, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] == null || process.env[key] === '') {
      process.env[key] = val;
    }
  }
}

loadEnvFile(envLocal);

if (!process.env.SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_URL) {
  process.env.SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_SERVICE_KEY) {
  console.error('[myfng-mcp] Missing SUPABASE_SERVICE_ROLE_KEY in apps/web/.env.local');
  process.exit(1);
}

if (!existsSync(entry)) {
  console.error('[myfng-mcp] Missing dist/index.js — run: cd packages/myfng-mcp && npm run build');
  process.exit(1);
}

process.env.MYFNG_MCP_MASK_PII ??= 'true';
process.env.MYFNG_MCP_MAX_ROWS ??= '50';

const child = spawn(process.execPath, [entry], {
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
