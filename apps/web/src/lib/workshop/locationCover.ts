import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

export const WORKSHOP_COVER_WIDTH = 1200;
export const WORKSHOP_COVER_HEIGHT = 400;

function escapeXml(value: string) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function normalizeMyFngTitle(raw: string) {
  return String(raw || '')
    .replace(/my\s*fng/gi, 'My FNG')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Card title like "My FNG Vartak Nagar" / "My FNG Majiwada". */
export function workshopLocationCoverTitle(input: {
  workshop_name?: string | null;
  name?: string | null;
  city?: string | null;
  gmb_business_name?: string | null;
}): string {
  const candidates = [input.workshop_name, input.name]
    .map((v) => String(v || '').trim())
    .filter((v) => v && /my\s*fng/i.test(v) && !/multi\s*brand/i.test(v) && v.length <= 48);
  if (candidates[0]) return normalizeMyFngTitle(candidates[0]);

  const gmb = String(input.gmb_business_name || '').trim();
  const atMatch = gmb.match(/\bat\s+(.+)$/i);
  if (atMatch?.[1]) {
    const parts = atMatch[1]
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    const area = parts.length >= 2 ? parts[0] : parts[0];
    if (area && area.length <= 40) return `My FNG ${area}`;
  }

  const city = String(input.city || '').trim();
  if (city) return `My FNG ${city}`;
  return 'My FNG';
}

function resolvePoppinsBoldPath() {
  const candidates = [
    path.join(process.cwd(), 'public', 'fonts', 'Poppins-Bold.ttf'),
    path.join(process.cwd(), 'apps', 'web', 'public', 'fonts', 'Poppins-Bold.ttf'),
  ];
  return candidates.find((p) => fs.existsSync(p)) || '';
}

function resolveWorkshopPhotoPath() {
  const candidates = [
    path.join(process.cwd(), 'public', 'media', 'workshop-covers', 'workshop-photo-base.png'),
    path.join(process.cwd(), 'apps', 'web', 'public', 'media', 'workshop-covers', 'workshop-photo-base.png'),
  ];
  return candidates.find((p) => fs.existsSync(p)) || '';
}

export async function renderWorkshopLocationCover(title: string): Promise<Buffer> {
  const label = normalizeMyFngTitle(title || 'My FNG') || 'My FNG';
  const fontSize = label.length > 32 ? 28 : label.length > 26 ? 32 : label.length > 20 ? 36 : 42;
  const bannerW = Math.min(1080, Math.max(720, Math.round(label.length * 18 + 160)));
  const bannerX = Math.round((WORKSHOP_COVER_WIDTH - bannerW) / 2);
  const fontPath = resolvePoppinsBoldPath();
  const fontFace = fontPath
    ? `@font-face { font-family: 'PoppinsCover'; src: url('data:font/ttf;base64,${fs.readFileSync(fontPath).toString('base64')}') format('truetype'); font-weight: 700; }`
    : '';

  const overlay = Buffer.from(
    `<svg width="${WORKSHOP_COVER_WIDTH}" height="${WORKSHOP_COVER_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <style>${fontFace}</style>
        <linearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#000000" stop-opacity="0.12"/>
          <stop offset="45%" stop-color="#000000" stop-opacity="0.28"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0.55"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#shade)"/>
      <text x="600" y="148" text-anchor="middle" fill="#FFFFFF" fill-opacity="0.95" font-family="PoppinsCover, Poppins, Arial" font-size="28" font-weight="700" letter-spacing="8">WORKSHOP</text>
      <rect x="${bannerX}" y="188" width="${bannerW}" height="88" rx="16" fill="#FFFFFF"/>
      <text x="600" y="248" text-anchor="middle" fill="#023D95" font-family="PoppinsCover, Poppins, Arial" font-size="${fontSize}" font-weight="700">${escapeXml(label)}</text>
    </svg>`,
  );

  const photoPath = resolveWorkshopPhotoPath();
  if (!photoPath) {
    return sharp(overlay).png().toBuffer();
  }

  const photo = await sharp(photoPath)
    .resize(WORKSHOP_COVER_WIDTH, WORKSHOP_COVER_HEIGHT, { fit: 'cover', position: 'centre' })
    .png()
    .toBuffer();

  return sharp(photo)
    .composite([{ input: overlay, top: 0, left: 0 }])
    .png()
    .toBuffer();
}

export function workshopCoverFileSlug(title: string, fallback = 'my-fng') {
  const slug = String(title || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
  return slug || fallback;
}
