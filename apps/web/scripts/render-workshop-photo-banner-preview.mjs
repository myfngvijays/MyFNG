import { writeFileSync, readFileSync, copyFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';
import sharp from 'sharp';

const W = 1200;
const H = 400;
const TITLE = 'My FNG Vasai East';
const source = '/Users/abcom/.cursor/projects/Users-abcom-Downloads-MyFNG/assets/preview-actual-workshop-vasai-east-source.png';
const outDir = path.join(process.cwd(), 'public', 'media', 'workshop-covers');
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
copyFileSync(source, path.join(outDir, 'source-actual-workshop.png'));

const fontPath = path.join(process.cwd(), 'public', 'fonts', 'Poppins-Bold.ttf');
const fontData = readFileSync(fontPath).toString('base64');

const overlay = Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>
      @font-face {
        font-family: 'PoppinsCover';
        src: url('data:font/ttf;base64,${fontData}') format('truetype');
        font-weight: 700;
      }
    </style>
    <linearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#000000" stop-opacity="0.12"/>
      <stop offset="45%" stop-color="#000000" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.55"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#shade)"/>
  <text x="600" y="148" text-anchor="middle" fill="#FFFFFF" fill-opacity="0.95" font-family="PoppinsCover, Poppins, Arial" font-size="28" font-weight="700" letter-spacing="8">WORKSHOP</text>
  <rect x="210" y="188" width="780" height="88" rx="16" fill="#FFFFFF"/>
  <text x="600" y="248" text-anchor="middle" fill="#023D95" font-family="PoppinsCover, Poppins, Arial" font-size="42" font-weight="700">${TITLE}</text>
</svg>`);

const photo = await sharp(source)
  .resize(W, H, { fit: 'cover', position: 'centre' })
  .png()
  .toBuffer();

const out = path.join(outDir, 'preview-workshop-photo-vasai-east.png');
const buf = await sharp(photo)
  .composite([{ input: overlay, top: 0, left: 0 }])
  .png()
  .toBuffer();
writeFileSync(out, buf);
console.log(out, buf.length);
