import { readFileSync } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const ROOT = process.cwd();
const TARGET_W = 1920;
const TARGET_H = 1080;
const MAX_BYTES = 200 * 1024;
const SLUG = process.argv[2] || 'how-doorstep-car-service-works-and-what-to-expect';
const COVER_FILE = process.argv[3] || 'sample-light-skip-service.png';

function loadEnv() {
  const raw = readFileSync(path.join(ROOT, '.env.local'), 'utf8');
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

function escapeXml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function wrapCoverTitle(title, maxChars = 16) {
  const words = String(title || '').replace(/\s+/g, ' ').trim().toUpperCase().split(' ').filter(Boolean);
  const lines = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else current = next;
  }
  if (current) lines.push(current);
  return lines.slice(0, 5);
}

function coverTitleSvg(title, variant) {
  const lines = wrapCoverTitle(title, 16);
  const fill = variant === 'light' ? '#003399' : '#FFFFFF';
  const panel = variant === 'light' ? '#F4F7FB' : '#0066FF';
  const lineH = 92;
  const startY = 400;
  const texts = lines
    .map((line, i) => `<text x="92" y="${startY + i * lineH}" font-size="72" font-weight="800" font-family="Arial, Helvetica, sans-serif" fill="${fill}">${escapeXml(line)}</text>`)
    .join('');
  return Buffer.from(
    `<svg width="${TARGET_W}" height="${TARGET_H}" xmlns="http://www.w3.org/2000/svg">
      <rect x="48" y="250" width="1080" height="560" fill="${panel}"/>
      ${texts}
    </svg>`,
  );
}

async function toWebp(input, title, coverFile) {
  const variant = String(coverFile || '').includes('light') ? 'light' : 'blue';
  let base = await sharp(input).resize(TARGET_W, TARGET_H, { fit: 'cover', position: 'centre' }).png().toBuffer();
  if (title) {
    base = await sharp(base).composite([{ input: coverTitleSvg(title, variant), top: 0, left: 0 }]).png().toBuffer();
  }
  let quality = 82;
  let last = base;
  for (let i = 0; i < 8; i++) {
    last = await sharp(base).webp({ quality, effort: 6 }).toBuffer();
    if (last.byteLength <= MAX_BYTES) return last;
    quality = Math.max(45, quality - 8);
  }
  return last;
}

async function main() {
  loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env');

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data: blog, error } = await supabase
    .from('blogs')
    .select('id, slug, title, seo_data')
    .eq('slug', SLUG)
    .maybeSingle();
  if (error || !blog) throw new Error(error?.message || `Blog not found: ${SLUG}`);

  const png = await fs.readFile(path.join(ROOT, 'public', 'media', 'blog-covers', COVER_FILE));
  const webp = await toWebp(png, blog.title, COVER_FILE);
  const storagePath = `blog-images/${blog.slug}-${Date.now()}.webp`;
  const { error: upErr } = await supabase.storage.from('service-media').upload(storagePath, webp, {
    contentType: 'image/webp',
    upsert: true,
    cacheControl: '3600',
  });
  if (upErr) throw new Error(upErr.message);

  const featured = `/media/service-media/${storagePath}`;
  const seo = { ...(blog.seo_data || {}), og_image: featured, featured_image_alt: `${blog.title} — MyFNG car service`.slice(0, 125) };
  const { error: updErr } = await supabase
    .from('blogs')
    .update({ featured_image: featured, seo_data: seo, updated_at: new Date().toISOString() })
    .eq('id', blog.id);
  if (updErr) throw new Error(updErr.message);

  console.log(JSON.stringify({ ok: true, slug: blog.slug, title: blog.title, featured }, null, 2));
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
