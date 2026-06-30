import { cpSync, existsSync, lstatSync, mkdirSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// workspace root = apps/web
const webRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(webRoot, '..', '..');
const candidates = [
  path.join(webRoot, 'node_modules', 'tinymce'),
  path.join(repoRoot, 'node_modules', 'tinymce'),
];
const src = candidates.find((p) => existsSync(p));
const dest = path.join(webRoot, 'public', 'tinymce');

if (!src) {
  console.error(`[copy-tinymce] Source not found. Looked in:\n- ${candidates.join('\n- ')}`);
  process.exit(1);
}

mkdirSync(path.join(webRoot, 'public'), { recursive: true });

// Force remove destination (handles broken symlinks that existsSync misses)
try { rmSync(dest, { recursive: true, force: true }); } catch {}

// Use shell cp -rL to reliably copy with symlink dereferencing
try {
  execSync(`cp -rL "${src}" "${dest}"`, { stdio: 'pipe' });
} catch {
  // Fallback to Node cpSync if shell cp fails
  cpSync(src, dest, { recursive: true, dereference: true, force: true });
}

console.log(`[copy-tinymce] Copied TinyMCE assets to ${dest}`);


