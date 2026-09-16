import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { mediaPathFromStorage } from '@/lib/media/public-url';

export const DAILY_BLOG_COVERS = [
  { key: 'light-mechanic', file: 'sample-light-skip-service.png' },
  { key: 'blue-mechanic', file: 'sample-blue-periodic-checklist.png' },
  { key: 'light-car', file: 'sample-light-skip-service-car.png' },
  { key: 'blue-car', file: 'sample-blue-periodic-checklist-car.png' },
  { key: 'light-closeup', file: 'sample-light-mechanic-closeup.png' },
  { key: 'blue-closeup', file: 'sample-blue-mechanic-closeup.png' },
] as const;

export type DailyCoverKey = (typeof DAILY_BLOG_COVERS)[number]['key'];

const MAX_BYTES = 200 * 1024;
const TARGET_W = 1920;
const TARGET_H = 1080;

export function pickDailyCover(dayOfYear: number) {
  return DAILY_BLOG_COVERS[dayOfYear % DAILY_BLOG_COVERS.length];
}

function escapeXml(s: string) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function wrapWords(text: string, maxChars: number): string[] {
  const words = String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
    .split(' ')
    .filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export function wrapCoverTitle(title: string, maxChars = 17): string[] {
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
      city = dashParts.pop() || '';
      head = dashParts.join(' ');
    }
  }
  const lines = wrapWords(head, maxChars);
  if (city) lines.push(`IN ${city.toUpperCase()}`);
  return lines.slice(0, 5);
}

function svgTitleLine(line: string) {
  return escapeXml(line).replace(/ /g, '&#160;');
}

async function coverTitlePng(title: string, variant: 'light' | 'blue') {
  const lines = wrapCoverTitle(title, 17);
  const fill = variant === 'light' ? '#003399' : '#FFFFFF';
  const fontSize = lines.length >= 5 ? 70 : lines.length === 4 ? 80 : 92;
  const lineH = fontSize + 22;
  const startY = 400;
  const texts = lines
    .map(
      (line, i) =>
        `<text x="92" y="${startY + i * lineH}" font-size="${fontSize}" font-weight="800" font-family="Arial, Helvetica, sans-serif" fill="${fill}" xml:space="preserve">${svgTitleLine(line)}</text>`,
    )
    .join('');
  const svg = Buffer.from(
    `<svg width="${TARGET_W}" height="${TARGET_H}" xmlns="http://www.w3.org/2000/svg">${texts}</svg>`,
  );
  return sharp(svg).png({ force: true }).toBuffer();
}

/** Rebuild the template field (no flat plate) so baked-in title letters disappear. */
async function restoreTitleField(base: Buffer) {
  const { data, info } = await sharp(base).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const pixels = Buffer.from(data);
  const at = (x: number, y: number) => (y * width + x) * channels;
  const x0 = 40;
  const x1 = Math.min(width, 1120);
  const y0 = 310;
  const y1 = Math.min(height, 860);
  const yTop = 268;
  const yBot = Math.min(height - 1, 888);

  for (let y = y0; y < y1; y += 1) {
    const t = (y - yTop) / Math.max(1, yBot - yTop);
    for (let x = x0; x < x1; x += 1) {
      const top = at(x, yTop);
      const bot = at(x, yBot);
      const i = at(x, y);
      pixels[i] = Math.round(data[top] + (data[bot] - data[top]) * t);
      pixels[i + 1] = Math.round(data[top + 1] + (data[bot + 1] - data[top + 1]) * t);
      pixels[i + 2] = Math.round(data[top + 2] + (data[bot + 2] - data[top + 2]) * t);
    }
  }

  return sharp(pixels, { raw: { width, height, channels } }).png().toBuffer();
}

async function toWebpUnderSize(input: Buffer, title?: string, coverFile?: string): Promise<Buffer> {
  const variant = String(coverFile || '').includes('light') ? 'light' : 'blue';
  let base = await sharp(input)
    .resize(TARGET_W, TARGET_H, { fit: 'cover', position: 'centre' })
    .png()
    .toBuffer();

  if (title && title.trim()) {
    base = await restoreTitleField(base);
    const overlay = await coverTitlePng(title.trim(), variant);
    base = await sharp(base)
      .composite([{ input: overlay, top: 0, left: 0 }])
      .png()
      .toBuffer();
  }

  let quality = 82;
  let last = base;
  for (let i = 0; i < 8; i++) {
    last = await sharp(base)
      .webp({ quality, effort: 6 })
      .toBuffer();
    if (last.byteLength <= MAX_BYTES) return last;
    quality = Math.max(45, quality - 8);
  }
  return last;
}

export async function uploadDailyCoverWebp(opts: {
  supabaseAdmin: any;
  slug: string;
  coverFile: string;
  title?: string;
}): Promise<{ url: string; keyFile: string }> {
  const filePath = path.join(process.cwd(), 'public', 'media', 'blog-covers', opts.coverFile);
  const input = await fs.readFile(filePath);
  const webp = await toWebpUnderSize(input, opts.title, opts.coverFile);
  const storagePath = `blog-images/${opts.slug}-${Date.now()}.webp`;

  const { error } = await opts.supabaseAdmin.storage.from('service-media').upload(storagePath, webp, {
    contentType: 'image/webp',
    upsert: true,
    cacheControl: '3600',
  });
  if (error) throw new Error(error.message || 'Failed to upload daily blog cover');

  return {
    url: mediaPathFromStorage('service-media', storagePath),
    keyFile: opts.coverFile,
  };
}
