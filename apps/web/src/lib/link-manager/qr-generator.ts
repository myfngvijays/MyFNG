import { normalizeQrStyle, resolveErrorCorrection, type QrStyleOptions } from '@/lib/link-manager/qr-types';

let QRCode: any = null;
let sharp: any = null;

async function getQrCodeLib() {
  if (QRCode) return QRCode;
  try {
    QRCode = require('qrcode');
    return QRCode;
  } catch {
    /* fall through */
  }
  try {
    const mod = await import('qrcode');
    QRCode = mod.default || mod;
    return QRCode;
  } catch {
    return null;
  }
}

try {
  sharp = require('sharp');
} catch {
  // optional
}

async function loadLogoBuffer(style: QrStyleOptions): Promise<Buffer | null> {
  if (style.logo_data_url) {
    const raw = String(style.logo_data_url);
    const base64 = raw.includes(',') ? raw.split(',')[1] : raw;
    try {
      return Buffer.from(base64, 'base64');
    } catch {
      return null;
    }
  }
  if (style.logo_url) {
    try {
      const res = await fetch(style.logo_url);
      if (!res.ok) return null;
      return Buffer.from(await res.arrayBuffer());
    } catch {
      return null;
    }
  }
  return null;
}

export async function generateBrandedQrDataUrl(data: string, rawStyle?: QrStyleOptions | null): Promise<string> {
  const style = normalizeQrStyle(rawStyle);
  const width = 512;
  const dark = style.dark_color || '#000000';
  const light = style.light_color || '#FFFFFF';
  const margin = Math.min(4, Math.max(1, Number(style.margin || 2)));
  const errorCorrectionLevel = resolveErrorCorrection(style);
  const QR = await getQrCodeLib();

  if (!QR) {
    throw new Error('QR library unavailable on server');
  }

  try {
    const qrBuffer: Buffer = await QR.toBuffer(data, {
      type: 'png',
      width,
      margin,
      errorCorrectionLevel,
      color: { dark, light },
    });

    const logoBuffer = await loadLogoBuffer(style);
    if (logoBuffer && sharp) {
      const logoSize = Math.round(width * (Math.min(30, Math.max(12, Number(style.logo_size_percent || 22))) / 100));
      const pad = Math.max(6, Math.round(logoSize * 0.1));
      const bg = parseHexColor(light);

      const logoPlate = await sharp({
        create: {
          width: logoSize + pad * 2,
          height: logoSize + pad * 2,
          channels: 4,
          background: { ...bg, alpha: 1 },
        },
      })
        .png()
        .toBuffer();

      const logo = await sharp(logoBuffer)
        .resize(logoSize, logoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();

      const logoComposite = await sharp(logoPlate)
        .composite([{ input: logo, gravity: 'center' }])
        .png()
        .toBuffer();

      const finalBuffer = await sharp(qrBuffer)
        .composite([{ input: logoComposite, gravity: 'center' }])
        .png()
        .toBuffer();

      return `data:image/png;base64,${finalBuffer.toString('base64')}`;
    }

    return `data:image/png;base64,${qrBuffer.toString('base64')}`;
  } catch (e) {
    console.error('Branded QR generation failed:', e);
    throw e instanceof Error ? e : new Error('Branded QR generation failed');
  }
}

function parseHexColor(hex: string) {
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    return {
      r: parseInt(clean[0] + clean[0], 16),
      g: parseInt(clean[1] + clean[1], 16),
      b: parseInt(clean[2] + clean[2], 16),
    };
  }
  return {
    r: parseInt(clean.slice(0, 2), 16) || 0,
    g: parseInt(clean.slice(2, 4), 16) || 0,
    b: parseInt(clean.slice(4, 6), 16) || 0,
  };
}

/** @deprecated use generateBrandedQrDataUrl */
export async function generateQrDataUrl(data: string): Promise<string> {
  return generateBrandedQrDataUrl(data, null);
}
