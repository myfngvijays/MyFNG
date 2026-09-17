import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, '../public');
const phoneSrc = path.join(publicDir, 'myfng-app-screenshot.png');
const ganeshSrc = path.join(publicDir, 'media/ganpati-popup.png');
const outPath = path.join(publicDir, 'app-download-popup.png');

const toDataUri = (filePath) => {
  const buf = fs.readFileSync(filePath);
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';
  return `data:${mime};base64,${buf.toString('base64')}`;
};

const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@600;700;800&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: 1600px; height: 900px; overflow: hidden; background: transparent; }
    .card {
      width: 1600px;
      height: 900px;
      border-radius: 48px;
      overflow: hidden;
      font-family: Inter, system-ui, sans-serif;
      background: linear-gradient(145deg, #1d4ed8 0%, #2563eb 46%, #4c1d95 100%);
      position: relative;
      color: #fff;
      box-shadow: inset 0 0 0 8px rgba(251, 191, 36, 0.55);
    }
    .glow {
      position: absolute; border-radius: 50%; pointer-events: none;
    }
    .glow.a { width: 420px; height: 420px; right: -80px; top: -90px; border: 16px solid rgba(251,191,36,0.12); }
    .glow.b { width: 220px; height: 220px; left: 380px; bottom: 120px; background: rgba(251,191,36,0.12); filter: blur(40px); }
    .dot { position: absolute; border-radius: 50%; }
    .dot.d1 { width: 14px; height: 14px; background: #fbbf24; top: 48px; left: 620px; }
    .dot.d2 { width: 10px; height: 10px; background: #fb923c; top: 92px; left: 760px; }
    .dot.d3 { width: 12px; height: 12px; background: #fde68a; bottom: 190px; right: 520px; }
    .main {
      height: 760px;
      display: flex;
      align-items: center;
      padding: 28px 40px 0 36px;
      gap: 28px;
    }
    .phone-col {
      width: 390px;
      flex-shrink: 0;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      height: 100%;
      position: relative;
    }
    .podium {
      position: absolute;
      bottom: 24px;
      width: 280px;
      height: 64px;
      background: radial-gradient(ellipse at center, #fbbf24 0%, #1d4ed8 72%);
      border-radius: 50%;
      opacity: 0.7;
    }
    .phone {
      width: 278px;
      height: 580px;
      background: #0b0b0f;
      border-radius: 40px;
      border: 10px solid #1f1f24;
      overflow: hidden;
      position: relative;
      z-index: 2;
      box-shadow: 0 30px 50px rgba(0,0,0,0.35);
      margin-bottom: 44px;
    }
    .phone img { width: 100%; height: 100%; object-fit: cover; object-position: top; }
    .notch {
      position: absolute; top: 10px; left: 50%; transform: translateX(-50%);
      width: 88px; height: 20px; background: #0b0b0f; border-radius: 999px; z-index: 3;
    }
    .copy { flex: 1; padding-top: 8px; }
    .title { font-size: 78px; line-height: 0.95; font-weight: 800; letter-spacing: -2px; }
    .subtitle { margin-top: 18px; color: #fbbf24; font-size: 30px; font-weight: 700; }
    .offer {
      display: inline-flex; align-items: center; gap: 10px;
      margin-top: 20px; background: #fbbf24; color: #111827;
      padding: 10px 18px; border-radius: 999px; font-weight: 800; font-size: 18px;
    }
    .bullets { margin-top: 28px; display: flex; flex-direction: column; gap: 14px; }
    .bullet { display: flex; align-items: center; gap: 12px; font-size: 26px; font-weight: 700; }
    .tick {
      width: 30px; height: 30px; border-radius: 50%;
      background: #fbbf24; color: #111827;
      display: flex; align-items: center; justify-content: center;
      font-size: 16px; font-weight: 800; flex-shrink: 0;
    }
    .btn {
      margin-top: 36px;
      display: inline-flex; align-items: center; gap: 12px;
      background: #fbbf24; color: #111827;
      padding: 18px 36px; border-radius: 18px;
      font-size: 30px; font-weight: 800;
      box-shadow: 0 12px 28px rgba(0,0,0,0.22);
    }
    .btn svg { width: 30px; height: 30px; }
    .ganesh-col {
      width: 400px; flex-shrink: 0; display: flex; flex-direction: column;
      align-items: center; justify-content: flex-end; height: 100%; padding: 18px 0 18px;
    }
    .festive { text-align: center; margin-bottom: 8px; }
    .festive .kicker {
      font-size: 16px; letter-spacing: 0.34em; text-transform: uppercase;
      color: #fde68a; font-weight: 700;
    }
    .festive .word {
      margin-top: 4px; font-family: Georgia, "Times New Roman", serif;
      font-size: 64px; font-weight: 900; font-style: italic; line-height: 0.95;
      background: linear-gradient(90deg, #fde68a, #fbbf24, #f59e0b);
      -webkit-background-clip: text; background-clip: text; color: transparent;
    }
    .festive .rule {
      margin: 10px auto 0; width: 92px; height: 2px;
      background: linear-gradient(90deg, transparent, #fbbf24, transparent);
    }
    .ganesh { width: 370px; height: 540px; object-fit: contain; object-position: bottom; filter: drop-shadow(0 18px 28px rgba(0,0,0,0.35)); }
    .footer {
      height: 140px;
      background: linear-gradient(90deg, #1e1b4b 0%, #4c1d95 100%);
      display: grid; grid-template-columns: repeat(4, 1fr);
      align-items: center; padding: 0 48px;
    }
    .trust { display: flex; align-items: center; justify-content: center; gap: 12px; }
    .icon {
      width: 44px; height: 44px; border-radius: 50%;
      background: #fbbf24; display: flex; align-items: center; justify-content: center;
    }
    .icon svg { width: 22px; height: 22px; fill: none; stroke: #111827; stroke-width: 2; }
    .trust span { font-size: 22px; font-weight: 700; }
  </style>
</head>
<body>
  <div class="card">
    <div class="glow a"></div>
    <div class="glow b"></div>
    <div class="dot d1"></div>
    <div class="dot d2"></div>
    <div class="dot d3"></div>
    <div class="main">
      <div class="phone-col">
        <div class="phone">
          <div class="notch"></div>
          <img src="${toDataUri(phoneSrc)}" alt="" />
        </div>
        <div class="podium"></div>
      </div>
      <div class="copy">
        <div class="title">Download<br/>MyFNG App</div>
        <div class="subtitle">Get 10% OFF on Your First Service!</div>
        <div class="offer">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#111827" stroke-width="2">
            <circle cx="12" cy="13" r="8"/>
            <path d="M12 9v4l3 2M9 3h6"/>
          </svg>
          LIMITED TIME OFFER
        </div>
        <div class="bullets">
          <div class="bullet"><div class="tick">✓</div>Free Pickup &amp; Drop</div>
          <div class="bullet"><div class="tick">✓</div>Live Service Updates</div>
          <div class="bullet"><div class="tick">✓</div>Transparent Pricing</div>
          <div class="bullet"><div class="tick">✓</div>24/7 Roadside Assistance</div>
        </div>
        <div class="btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="#111827" stroke-width="2.4">
            <path d="M12 3v12"/>
            <path d="M7 11l5 5 5-5"/>
            <path d="M5 19h14"/>
          </svg>
          Download App
        </div>
      </div>
      <div class="ganesh-col">
        <div class="festive">
          <div class="kicker">✦ Ganesh Chaturthi ✦</div>
          <div class="word">Offer</div>
          <div class="rule"></div>
        </div>
        <img class="ganesh" src="${toDataUri(ganeshSrc)}" alt="" />
      </div>
    </div>
    <div class="footer">
      <div class="trust"><div class="icon"><svg viewBox="0 0 24 24"><path d="M12 3l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V7l8-4z"/></svg></div><span>Trusted Professionals</span></div>
      <div class="trust"><div class="icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M8 14l-2 7 6-3 6 3-2-7"/></svg></div><span>Quality Assured</span></div>
      <div class="trust"><div class="icon"><svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg></div><span>Secure Payments</span></div>
      <div class="trust"><div class="icon"><svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 0 1 16 0"/><path d="M4 12v4a2 2 0 0 0 2 2h1v-6H4zm13 0h3v6h-1a2 2 0 0 0-2-2v-4z"/><path d="M12 19v2"/></svg></div><span>Customer Support</span></div>
    </div>
  </div>
</body>
</html>`;

const browser = await puppeteer.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 900, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle0' });
await page.screenshot({ path: outPath, type: 'png', omitBackground: true });
await browser.close();
console.log('wrote', outPath);
