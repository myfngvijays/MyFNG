import { writeFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';
import sharp from 'sharp';

const W = 1200;
const H = 400;
const logoPath = path.join(process.cwd(), 'public', 'logo.png');

function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function slugify(title) {
  return String(title || 'my-fng')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
}

async function render(title) {
  const fontSize = title.length > 28 ? 40 : title.length > 20 ? 46 : 52;
  const logo = await sharp(logoPath).resize({ width: 460, height: 140, fit: 'inside' }).png().toBuffer();
  const meta = await sharp(logo).metadata();
  const logoW = Number(meta.width || 460);
  const logoH = Number(meta.height || 140);
  const logoLeft = Math.round((W - logoW) / 2);
  const logoTop = 78;
  const textSvg = Buffer.from(
    `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#F0F7FF"/>
      <rect x="24" y="24" width="${W - 48}" height="${H - 48}" rx="28" fill="#FFFFFF" stroke="#023D95" stroke-width="3"/>
      <text x="600" y="${logoTop + logoH + 78}" text-anchor="middle" fill="#023D95" font-size="${fontSize}" font-family="Arial, Helvetica, sans-serif" font-weight="800">${escapeXml(title)}</text>
    </svg>`,
  );
  return sharp(textSvg).composite([{ input: logo, top: logoTop, left: logoLeft }]).png().toBuffer();
}

const outDir = path.join(process.cwd(), 'public', 'media', 'workshop-covers');
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const titles = ['My FNG', 'My FNG Vartak Nagar', 'My FNG Majiwada', 'My FNG Virar West', 'My FNG Wakad'];
for (const title of titles) {
  const buf = await render(title);
  const name = title === 'My FNG' ? 'default.png' : `${slugify(title)}.png`;
  writeFileSync(path.join(outDir, name), buf);
  console.log(name, buf.length);
}
