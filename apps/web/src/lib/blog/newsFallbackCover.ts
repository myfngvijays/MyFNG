import sharp from 'sharp';

/** Same width the daily news uploader stores, at the desk card ratio (16:10). */
export const NEWS_COVER_WIDTH = 1400;
export const NEWS_COVER_HEIGHT = 875;

const SEARCH_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function wrapTitle(title: string, maxChars: number) {
  const words = String(title || '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (current && next.length > maxChars) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 3);
}

function titleOverlay(title: string) {
  const lines = wrapTitle(title || 'Automobile News', 36);
  const fontSize = lines.length >= 3 ? 40 : 44;
  const lineHeight = Math.round(fontSize * 1.35);
  const barHeight = lines.length >= 3 ? 250 : 220;
  const center = barHeight / 2;
  const text = lines
    .map((line, index) => {
      const y = center + (index - (lines.length - 1) / 2) * lineHeight;
      return `<text x="700" y="${y}" text-anchor="middle" dominant-baseline="central" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="700" fill="#ffffff">${escapeXml(line)}</text>`;
    })
    .join('');
  return Buffer.from(`<svg width="${NEWS_COVER_WIDTH}" height="${NEWS_COVER_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${NEWS_COVER_WIDTH}" height="${barHeight}" fill="#111111"/>
  <rect y="${barHeight}" width="${NEWS_COVER_WIDTH}" height="5" fill="#0088E8"/>
  ${text}
</svg>`);
}

/** Car photo, cropped to the article size, with the headline on a transparent overlay. No logo. */
export async function buildNewsPhotoCover(photo: Buffer, title: string): Promise<Buffer> {
  const base = await sharp(photo)
    .rotate()
    .resize(NEWS_COVER_WIDTH, NEWS_COVER_HEIGHT, { fit: 'cover', position: 'centre' })
    .toBuffer();
  return sharp(base)
    .composite([{ input: titleOverlay(title), left: 0, top: 0 }])
    .webp({ quality: 78 })
    .toBuffer();
}

type WebPhoto = { image: string; width: number; height: number; title: string };

async function searchWebPhotos(query: string): Promise<WebPhoto[]> {
  const q = encodeURIComponent(query);
  const page = await fetch(`https://duckduckgo.com/?q=${q}&iax=images&ia=images`, {
    headers: { 'User-Agent': SEARCH_UA },
  });
  if (!page.ok) return [];
  const html = await page.text();
  const vqd = html.match(/vqd=([\d-]+)/)?.[1] || html.match(/vqd="([\d-]+)"/)?.[1];
  if (!vqd) return [];
  const img = await fetch(`https://duckduckgo.com/i.js?l=us-en&o=json&q=${q}&vqd=${vqd}&f=,,,,,&p=1`, {
    headers: { 'User-Agent': SEARCH_UA, Referer: 'https://duckduckgo.com/' },
  });
  if (!img.ok) return [];
  const json = await img.json().catch(() => null) as { results?: Array<{ image?: string; width?: number; height?: number; title?: string }> } | null;
  return (json?.results || [])
    .map((item) => ({
      image: String(item.image || ''),
      width: Number(item.width || 0),
      height: Number(item.height || 0),
      title: String(item.title || ''),
    }))
    .filter((item) => item.image.startsWith('http') && item.width >= 800 && item.height >= 420);
}

function photoQuery(title: string) {
  const clean = String(title || '')
    .replace(/\b(20\d{2}|india|debut|launch|facelift|set to|make its|a new|for everyday use)\b/gi, ' ')
    .replace(/[^a-z0-9\s-]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return clean.slice(0, 80) || 'car suv india';
}

/** First usable press-style photo for a headline. Skips logos and portraits. */
export async function findNewsWebPhoto(title: string): Promise<Buffer | null> {
  const queries = [photoQuery(title), `${photoQuery(title)} car`, 'car suv india'];
  for (const query of queries) {
    const photos = await searchWebPhotos(query);
    for (const photo of photos) {
      if (/logo|icon|emoji|person|portrait/i.test(photo.title)) continue;
      if (photo.height > photo.width * 1.2) continue;
      try {
        const response = await fetch(photo.image, {
          headers: { 'User-Agent': SEARCH_UA, Accept: 'image/avif,image/webp,image/png,image/jpeg' },
        });
        if (!response.ok) continue;
        const type = response.headers.get('content-type') || '';
        if (type && !/^image\/(jpeg|png|webp|avif)/.test(type)) continue;
        const input = Buffer.from(await response.arrayBuffer());
        if (input.length < 8000) continue;
        const meta = await sharp(input).metadata();
        if (!meta.width || meta.width < 700) continue;
        return input;
      } catch {
        // try the next result
      }
    }
  }
  return null;
}
