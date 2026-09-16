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

function wrapCoverTitle(title: string, maxChars = 16): string[] {
  const words = String(title || '')
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
  return lines.slice(0, 5);
}

function coverTitleSvg(title: string, variant: 'light' | 'blue') {
  const lines = wrapCoverTitle(title, 16);
  const fill = variant === 'light' ? '#003399' : '#FFFFFF';
  const panel = variant === 'light' ? '#F4F7FB' : '#0066FF';
  const lineH = 92;
  const startY = 400;
  const texts = lines
    .map(
      (line, i) =>
        `<text x="92" y="${startY + i * lineH}" font-size="72" font-weight="800" font-family="Arial, Helvetica, sans-serif" fill="${fill}">${escapeXml(line)}</text>`,
    )
    .join('');
  return Buffer.from(
    `<svg width="${TARGET_W}" height="${TARGET_H}" xmlns="http://www.w3.org/2000/svg">
      <rect x="48" y="250" width="1080" height="560" fill="${panel}"/>
      ${texts}
    </svg>`,
  );
}

async function toWebpUnderSize(input: Buffer, title?: string, coverFile?: string): Promise<Buffer> {
  const variant = String(coverFile || '').includes('light') ? 'light' : 'blue';
  let base = await sharp(input)
    .resize(TARGET_W, TARGET_H, { fit: 'cover', position: 'centre' })
    .png()
    .toBuffer();

  if (title && title.trim()) {
    base = await sharp(base)
      .composite([{ input: coverTitleSvg(title.trim(), variant), top: 0, left: 0 }])
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
