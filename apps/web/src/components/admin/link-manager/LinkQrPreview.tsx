'use client';

import { useEffect, useState } from 'react';
import { Loader2, QrCode } from 'lucide-react';
import { buildClientQrShortUrl, buildQrShortUrl } from '@/lib/link-manager/utils';
import { DEFAULT_QR_STYLE } from '@/lib/link-manager/qr-types';
import { renderBrandedQrCanvas } from './QrLivePreview';

export default function LinkQrPreview({
  shortCode,
  shortUrl: _shortUrl,
  className = 'w-full max-w-[220px] mx-auto border rounded-xl bg-white p-2',
}: {
  shortCode: string;
  shortUrl?: string | null;
  className?: string;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const qrText = buildClientQrShortUrl(shortCode);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const url = await renderBrandedQrCanvas(qrText, DEFAULT_QR_STYLE, 512);
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
  }, [qrText]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center min-h-[220px] ${className}`}>
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!dataUrl) {
    return (
      <div className={`flex items-center justify-center min-h-[220px] text-gray-400 text-sm gap-2 ${className}`}>
        <QrCode className="w-4 h-4" /> QR preview failed
      </div>
    );
  }

  return <img src={dataUrl} alt="QR code" className={className} data-qr-download={dataUrl} />;
}

export function getLinkQrDownloadUrl(shortCode: string, _shortUrl?: string | null) {
  const qrText = typeof window !== 'undefined' ? buildClientQrShortUrl(shortCode) : buildQrShortUrl(shortCode);
  return renderBrandedQrCanvas(qrText, DEFAULT_QR_STYLE, 512);
}
