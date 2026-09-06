/**
 * Compile packages/myfng-mcp so /api/mcp can load dist at runtime.
 * Never fail the web build if MCP compile is skipped.
 */
import { spawnSync } from 'child_process';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = join(webRoot, '../../packages/myfng-mcp');
const out = join(pkg, 'dist/createServer.js');

if (!existsSync(join(pkg, 'package.json'))) {
  console.warn('[ensure-myfng-mcp] packages/myfng-mcp missing — skip');
  process.exit(0);
}

if (existsSync(out)) {
  console.log('[ensure-myfng-mcp] dist already present');
  process.exit(0);
}

const sdkHere = join(pkg, 'node_modules/@modelcontextprotocol/sdk');
if (!existsSync(sdkHere)) {
  console.log('[ensure-myfng-mcp] installing package dependencies');
  const install = spawnSync('npm', ['install', '--omit=dev'], {
    cwd: pkg,
    stdio: 'inherit',
    env: process.env,
  });
  if ((install.status ?? 1) !== 0) {
    console.warn('[ensure-myfng-mcp] npm install failed — /api/mcp may be unavailable');
    process.exit(0);
  }
}

const tscCandidates = [
  join(webRoot, 'node_modules/typescript/bin/tsc'),
  join(pkg, 'node_modules/typescript/bin/tsc'),
  join(webRoot, '../../node_modules/typescript/bin/tsc'),
];
const tsc = tscCandidates.find((p) => existsSync(p));
if (!tsc) {
  console.warn('[ensure-myfng-mcp] tsc not found — skip MCP compile');
  process.exit(0);
}

console.log('[ensure-myfng-mcp] compiling packages/myfng-mcp');
const compiled = spawnSync(process.execPath, [tsc, '-p', 'tsconfig.json'], {
  cwd: pkg,
  stdio: 'inherit',
  env: process.env,
});
if ((compiled.status ?? 1) !== 0) {
  console.warn('[ensure-myfng-mcp] tsc failed — /api/mcp may be unavailable');
}
