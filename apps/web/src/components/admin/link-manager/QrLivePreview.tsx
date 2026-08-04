'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { normalizeQrStyle, resolveErrorCorrection, type QrStyleOptions } from '@/lib/link-manager/qr-types';

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function renderBrandedQrCanvas(
  text: string,
  rawStyle?: QrStyleOptions | null,
  size = 280,
): Promise<string> {
  const style = normalizeQrStyle(rawStyle);
  const QRCode = (await import('qrcode')).default;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  await QRCode.toCanvas(canvas, text, {
    width: size,
    margin: Math.min(4, Math.max(1, Number(style.margin || 2))),
    errorCorrectionLevel: resolveErrorCorrection(style),
    color: {
      dark: style.dark_color || '#000000',
      light: style.light_color || '#FFFFFF',
    },
  });

  const logoSrc = style.logo_data_url || style.logo_url;
  if (logoSrc) {
    const ctx = canvas.getContext('2d');
    if (ctx) {
      try {
        const img = await loadImage(logoSrc);
        const logoSize = size * (Math.min(30, Math.max(12, Number(style.logo_size_percent || 22))) / 100);
        const x = (size - logoSize) / 2;
        const y = (size - logoSize) / 2;
        const pad = Math.max(4, logoSize * 0.08);
        ctx.fillStyle = style.light_color || '#FFFFFF';
        if (typeof ctx.roundRect === 'function') {
          ctx.beginPath();
          ctx.roundRect(x - pad, y - pad, logoSize + pad * 2, logoSize + pad * 2, 8);
          ctx.fill();
        } else {
          ctx.fillRect(x - pad, y - pad, logoSize + pad * 2, logoSize + pad * 2);
        }
        ctx.drawImage(img, x, y, logoSize, logoSize);
      } catch {
        // logo failed — keep plain QR
      }
    }
  }

  return canvas.toDataURL('image/png');
}

export default function QrLivePreview({
  text,
  qrStyle,
  className = '',
}: {
  text: string;
  qrStyle: QrStyleOptions;
  className?: string;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        if (!text) {
          setDataUrl(null);
          return;
        }
        const url = await renderBrandedQrCanvas(text, qrStyle, 280);
        if (!cancelled) setDataUrl(url);
      } catch {
        if (!cancelled) setDataUrl(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [text, qrStyle]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center w-44 h-44 border rounded-xl bg-white ${className}`}>
        <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!dataUrl) {
    return (
      <div className={`flex items-center justify-center w-44 h-44 border rounded-xl bg-gray-50 text-xs text-gray-400 ${className}`}>
        Enter URL to preview QR
      </div>
    );
  }

  return (
    <img
      src={dataUrl}
      alt="QR preview"
      className={`w-44 h-44 border rounded-xl bg-white p-2 shadow-sm ${className}`}
    />
  );
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
