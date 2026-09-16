import { readFileSync } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const ROOT = process.cwd();
const TARGET_W = 1920;
const TARGET_H = 1080;
const MAX_BYTES = 200 * 1024;
const SLUG = process.argv[2] || 'coolant-leak-and-engine-overheating-early-signs-and-safe-next-steps';
const COVER_FILE = process.argv[3] || 'sample-blue-periodic-checklist.png';

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

function wrapWords(text, maxChars) {
  const words = String(text || '').replace(/\s+/g, ' ').trim().toUpperCase().split(' ').filter(Boolean);
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
  return lines;
}

function wrapCoverTitle(title) {
  const raw = String(title || '').replace(/\s+/g, ' ').trim();
  const inMatch = raw.match(/^(.*)\s+in\s+(.+)$/i);
  let city = '';
  let head = raw;
  if (inMatch) {
    city = inMatch[2].trim();
    head = inMatch[1].trim();
  } else {
    const dashParts = raw.split(/\s+[–—-]\s+/);
    if (dashParts.length > 1) {
      city = dashParts.pop();
      head = dashParts.join(' ');
    }
  }
  const lines = wrapWords(head, 18);
  if (city) lines.push(`IN ${city.toUpperCase()}`);
  return lines.slice(0, 5);
}

function coverTitle(title, seo) {
  const city = String(seo?.local_city || seo?.ai_city || '').trim();
  let next = String(title || '').replace(/\s+/g, ' ').trim();
  if (city) {
    next = next
      .replace(new RegExp(`\\s+in\\s+${city.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\s*$`, 'i'), '')
      .replace(new RegExp(`\\s+[–—\\-|:]\\s+${city.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\s*$`, 'i'), '')
      .trim();
    next = `${next} in ${city}`;
  }
  return next;
}

async function coverTitlePng(title, variant) {
  const lines = wrapCoverTitle(title);
  const fill = variant === 'light' ? '#003399' : '#FFFFFF';
  const fontSize = lines.length >= 5 ? 72 : lines.length === 4 ? 84 : 96;
  const lineH = fontSize + 18;
  const texts = lines
    .map((line, i) => `<text x="92" y="${390 + i * lineH}" font-size="${fontSize}" font-weight="800" font-family="Arial, Helvetica, sans-serif" fill="${fill}">${escapeXml(line)}</text>`)
    .join('');
  const svg = Buffer.from(
    `<svg width="${TARGET_W}" height="${TARGET_H}" xmlns="http://www.w3.org/2000/svg">${texts}</svg>`,
  );
  return sharp(svg).png({ force: true }).toBuffer();
}

async function eraseOriginalTitle(base, variant) {
  const { data, info } = await sharp(base).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const src = data;
  const pixels = Buffer.from(data);
  const lum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
  const at = (x, y) => (y * width + x) * channels;
  const isTitle = (r, g, b) =>
    variant === 'light' ? lum(r, g, b) < 140 && r < 100 && g < 130 : lum(r, g, b) > 78 && r > 60 && g > 60;
  const x0 = 40;
  const x1 = Math.min(width, 1280);
  const y0 = 250;
  const y1 = Math.min(height, 860);
  const pad = 6;
  const mask = Buffer.alloc(width * height);

  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const i = at(x, y);
      if (isTitle(src[i], src[i + 1], src[i + 2])) mask[y * width + x] = 1;
    }
  }

  const dilated = Buffer.from(mask);
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      if (!mask[y * width + x]) continue;
      for (let dy = -pad; dy <= pad; dy += 1) {
        const yy = y + dy;
        if (yy < y0 || yy >= y1) continue;
        for (let dx = -pad; dx <= pad; dx += 1) {
          const xx = x + dx;
          if (xx < x0 || xx >= x1) continue;
          dilated[yy * width + xx] = 1;
        }
      }
    }
  }

  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      if (!dilated[y * width + x]) continue;
      let si = -1;
      for (let d = 1; d < 80; d += 1) {
        const xl = x - d;
        const xr = x + d;
        if (xl >= x0 && !dilated[y * width + xl]) {
          si = at(xl, y);
          break;
        }
        if (xr < x1 && !dilated[y * width + xr]) {
          si = at(xr, y);
          break;
        }
      }
      if (si < 0) si = at(72, y);
      const i = at(x, y);
      pixels[i] = src[si];
      pixels[i + 1] = src[si + 1];
      pixels[i + 2] = src[si + 2];
    }
  }

  return sharp(pixels, { raw: { width, height, channels } }).png().toBuffer();
}

async function toWebp(input, title, coverFile) {
  const variant = String(coverFile || '').includes('light') ? 'light' : 'blue';
  let base = await sharp(input).resize(TARGET_W, TARGET_H, { fit: 'cover', position: 'centre' }).png().toBuffer();
  if (title) {
    base = await eraseOriginalTitle(base, variant);
    const overlay = await coverTitlePng(title, variant);
    base = await sharp(base).composite([{ input: overlay, top: 0, left: 0 }]).png().toBuffer();
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

  const title = coverTitle(blog.title, blog.seo_data || {});
  const png = await fs.readFile(path.join(ROOT, 'public', 'media', 'blog-covers', COVER_FILE));
  const webp = await toWebp(png, title, COVER_FILE);
  const storagePath = `blog-images/${blog.slug}-${Date.now()}.webp`;
  const { error: upErr } = await supabase.storage.from('service-media').upload(storagePath, webp, {
    contentType: 'image/webp',
    upsert: true,
    cacheControl: '3600',
  });
  if (upErr) throw new Error(upErr.message);

  const featured = `/media/service-media/${storagePath}`;
  const seo = { ...(blog.seo_data || {}), og_image: featured, featured_image_alt: `${title} — MyFNG car service`.slice(0, 125) };
  const { error: updErr } = await supabase
    .from('blogs')
    .update({ featured_image: featured, seo_data: seo, updated_at: new Date().toISOString() })
    .eq('id', blog.id);
  if (updErr) throw new Error(updErr.message);

  console.log(JSON.stringify({ ok: true, slug: blog.slug, title, featured }, null, 2));
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
