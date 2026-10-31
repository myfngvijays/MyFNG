/**
 * Build into `.next-build`, then swap it into `.next` only after success.
 * The live PM2 process keeps serving the old `.next` during compile, so
 * standalone assemble does not rmdir a folder the running server is writing.
 */
import { spawnSync } from 'child_process';
import { existsSync, renameSync, rmSync } from 'fs';
import { createRequire } from 'module';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const nextBin = require.resolve('next/dist/bin/next');
const stagingName = '.next-build';
const liveName = '.next';
const previousName = '.next-previous';

function buildEnv() {
  return { ...process.env, MYFNG_DIST_DIR: stagingName };
}

function cleanStaging() {
  rmSync(join(root, stagingName), { recursive: true, force: true });
}

function build() {
  return spawnSync(process.execPath, [nextBin, 'build'], {
    cwd: root,
    stdio: 'inherit',
    env: buildEnv(),
  });
}

function syncStandaloneAssets() {
  return spawnSync(process.execPath, [join(root, 'scripts/sync-standalone-assets.mjs')], {
    cwd: root,
    stdio: 'inherit',
    env: buildEnv(),
  });
}

function promoteStaging() {
  const staging = join(root, stagingName);
  const live = join(root, liveName);
  const previous = join(root, previousName);
  if (!existsSync(join(staging, 'standalone'))) {
    console.error('[next-build-safe] staging build has no standalone output');
    return false;
  }
  rmSync(previous, { recursive: true, force: true });
  if (existsSync(live)) renameSync(live, previous);
  renameSync(staging, live);
  console.log('[next-build-safe] promoted .next-build to .next');
  return true;
}

spawnSync(process.execPath, [join(root, 'scripts/ensure-myfng-mcp.mjs')], {
  stdio: 'inherit',
});

cleanStaging();
let result = build();
if ((result.status ?? 1) !== 0) {
  console.warn('[next-build-safe] first build failed — clearing staging and retrying once');
  cleanStaging();
  result = build();
}
if ((result.status ?? 1) === 0) {
  const synced = syncStandaloneAssets();
  if ((synced.status ?? 1) !== 0 || !promoteStaging()) {
    process.exit(synced.status || 1);
  }
}
process.exit(result.status ?? 1);
