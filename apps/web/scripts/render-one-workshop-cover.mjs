import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';
import sharp from 'sharp';

const W = 1200;
const H = 400;
const TITLE = 'My FNG Vasai East';
const BG = '#023D95';
const fontPath = path.join(process.cwd(), 'public', 'fonts', 'Poppins-Bold.ttf');
const fontData = readFileSync(fontPath).toString('base64');
const fontSize = 64;

const svg = Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>
      @font-face {
        font-family: 'PoppinsCover';
        src: url('data:font/ttf;base64,${fontData}') format('truetype');
        font-weight: 700;
      }
    </style>
  </defs>
  <rect width="100%" height="100%" fill="${BG}"/>
  <text x="600" y="222" text-anchor="middle" fill="#FFFFFF" font-family="PoppinsCover, Poppins, Arial" font-size="${fontSize}" font-weight="700">${TITLE}</text>
</svg>`);

const outDir = path.join(process.cwd(), 'public', 'media', 'workshop-covers');
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, 'preview-vasai-east.png');
const buf = await sharp(svg).png().toBuffer();
writeFileSync(out, buf);
console.log(out, buf.length);
