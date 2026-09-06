/**
 * Clean leftover standalone cache, then next build.
 * If Next still hits ENOTEMPTY (live PM2 wrote mid-build), clean once and retry.
 */
import { spawnSync } from 'child_process';
import { createRequire } from 'module';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const nextBin = require.resolve('next/dist/bin/next');

function clean() {
  spawnSync(process.execPath, [join(root, 'scripts/clean-next-standalone-cache.mjs')], {
    stdio: 'inherit',
  });
}

function build() {
  return spawnSync(process.execPath, [nextBin, 'build'], {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  });
}

function syncStandaloneAssets() {
  spawnSync(process.execPath, [join(root, 'scripts/sync-standalone-assets.mjs')], {
    stdio: 'inherit',
  });
}

spawnSync(process.execPath, [join(root, 'scripts/ensure-myfng-mcp.mjs')], {
  stdio: 'inherit',
});

clean();
let result = build();
if ((result.status ?? 1) !== 0) {
  console.warn('[next-build-safe] first build failed — clearing cache and retrying once');
  clean();
  result = build();
}
if ((result.status ?? 1) === 0) {
  syncStandaloneAssets();
}
process.exit(result.status ?? 1);
