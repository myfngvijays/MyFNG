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

async function toWebpUnderSize(input: Buffer): Promise<Buffer> {
  let quality = 82;
  let last = input;
  for (let i = 0; i < 8; i++) {
    last = await sharp(input)
      .resize(TARGET_W, TARGET_H, { fit: 'cover', position: 'centre' })
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
}): Promise<{ url: string; keyFile: string }> {
  const filePath = path.join(process.cwd(), 'public', 'media', 'blog-covers', opts.coverFile);
  const input = await fs.readFile(filePath);
  const webp = await toWebpUnderSize(input);
  const storagePath = `blog-images/${opts.slug}.webp`;

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
