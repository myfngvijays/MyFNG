'use client';

import { Copy, Download, ExternalLink, Link2, QrCode } from 'lucide-react';
import {
  appendUtmParams,
  buildPreviewShortCode,
  buildProductionShortUrl,
  buildShortUrl,
  clientAppBaseUrl,
  isValidHttpUrl,
  normalizeLongUrl,
} from '@/lib/link-manager/utils';
import { DEFAULT_QR_STYLE, type QrStyleOptions } from '@/lib/link-manager/qr-types';
import QrLivePreview, { downloadDataUrl, renderBrandedQrCanvas } from './QrLivePreview';
import LinkQrPreview from './LinkQrPreview';

type PreviewForm = {
  long_url: string;
  title: string;
  custom_code: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_term: string;
  utm_content: string;
  expires_label: string;
};

export default function LinkPreviewPanel({
  form,
  mode,
  qrStyle,
  created,
  onCopy,
}: {
  form: PreviewForm;
  mode: 'link' | 'qr';
  qrStyle?: QrStyleOptions;
  created?: any | null;
  onCopy?: (text: string, label: string) => void;
}) {
  const previewCode = buildPreviewShortCode(form.custom_code);
  const shortUrl = buildShortUrl(previewCode, clientAppBaseUrl());
  const qrPreviewUrl = buildProductionShortUrl(previewCode);
  const style = qrStyle || DEFAULT_QR_STYLE;
  const createdMode = created?.create_mode === 'qr_only' || created?.meta?.create_mode === 'qr_only'
    ? 'qr'
    : created?.create_mode === 'link_only' || created?.meta?.create_mode === 'link_only'
      ? 'link'
      : mode;

  if (created) {
    return (
      <div className="rounded-2xl border border-green-200 bg-green-50 p-5 space-y-4 h-full">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-green-700">
            {createdMode === 'qr' ? 'QR ready' : 'Short link ready'}
          </p>
          <h3 className="text-lg font-bold text-gray-900 mt-1">{created.title || 'Untitled'}</h3>
        </div>

        {createdMode === 'link' ? (
          <div className="rounded-xl bg-white border p-3">
            <p className="text-xs text-gray-500 mb-1">Your short URL</p>
            <p className="text-sm font-semibold text-blue-700 break-all">{created.short_url}</p>
          </div>
        ) : null}

        {createdMode === 'qr' ? (
          <div className="flex flex-col items-center gap-2">
            <LinkQrPreview
              shortCode={created.short_code}
              shortUrl={created.short_url || buildProductionShortUrl(created.short_code)}
              className="w-48 h-48 border rounded-xl bg-white p-2 shadow-sm"
            />
            <button
              type="button"
              onClick={async () => {
                const dataUrl = await renderBrandedQrCanvas(
                  buildProductionShortUrl(created.short_code),
                  style,
                  512,
                );
                downloadDataUrl(dataUrl, `qr-${created.short_code}.png`);
              }}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600"
            >
              <Download className="w-3.5 h-3.5" /> Download PNG
            </button>
          </div>
        ) : null}

        {createdMode === 'qr' && created.short_url ? (
          <div className="rounded-xl bg-white/80 border border-green-100 p-3">
            <p className="text-xs text-gray-500 mb-1">Tracking short link (for edits)</p>
            <p className="text-xs font-medium text-blue-700 break-all">{created.short_url}</p>
          </div>
        ) : null}

        {createdMode === 'link' ? (
          <button
            type="button"
            onClick={() => onCopy?.(created.short_url, 'Short URL')}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-semibold"
          >
            <Copy className="w-4 h-4" /> Copy short URL
          </button>
        ) : null}
      </div>
    );
  }

  const destination = form.long_url && isValidHttpUrl(normalizeLongUrl(form.long_url))
    ? appendUtmParams(normalizeLongUrl(form.long_url), {
        source: form.utm_source,
        medium: form.utm_medium,
        campaign: form.utm_campaign,
        term: form.utm_term,
        content: form.utm_content,
      })
    : '';

  async function handleDownloadPreview() {
    const url = await renderBrandedQrCanvas(qrPreviewUrl, style, 512);
    downloadDataUrl(url, `qr-preview-${previewCode}.png`);
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm h-full">
      <div className="flex items-center gap-2 mb-4">
        {mode === 'qr' ? <QrCode className="w-4 h-4 text-blue-600" /> : <Link2 className="w-4 h-4 text-blue-600" />}
        <h3 className="font-bold text-gray-900">Live preview</h3>
      </div>

      <div className="space-y-4">
        {mode === 'link' ? (
          <div className="rounded-xl bg-blue-50 border border-blue-100 p-4">
            <p className="text-xs font-semibold text-blue-700 mb-1">Short URL preview</p>
            <p className="text-base font-bold text-blue-800 break-all">{shortUrl}</p>
            {!form.custom_code ? (
              <p className="text-xs text-blue-600 mt-1">Random code assigned on shorten</p>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col items-center py-1">
            <QrLivePreview text={qrPreviewUrl} qrStyle={style} />
            <p className="text-xs text-gray-500 mt-2 text-center">QR encodes {qrPreviewUrl}</p>
            <button
              type="button"
              onClick={handleDownloadPreview}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600"
            >
              <Download className="w-3.5 h-3.5" /> Download preview PNG
            </button>
          </div>
        )}

        <div>
          <p className="text-xs font-semibold text-gray-500 mb-1">
            {mode === 'link' ? 'Long URL (destination)' : 'Destination URL'}
          </p>
          <p className="text-sm text-gray-800 break-all rounded-lg bg-gray-50 border px-3 py-2 min-h-[48px]">
            {destination || 'Paste a valid long URL above'}
          </p>
        </div>

        {form.title ? (
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-1">Title</p>
            <p className="text-sm font-medium text-gray-900">{form.title}</p>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2 text-xs">
          {[
            ['Source', form.utm_source],
            ['Medium', form.utm_medium],
            ['Campaign', form.utm_campaign],
            ['Term', form.utm_term],
            ['Content', form.utm_content],
            ['Expiry', form.expires_label],
          ].map(([label, value]) =>
            value ? (
              <div key={label} className="rounded-lg bg-gray-50 border px-2 py-1.5">
                <span className="text-gray-500">{label}: </span>
                <span className="font-semibold text-gray-800">{value}</span>
              </div>
            ) : null,
          )}
        </div>

        {mode === 'qr' && (style.logo_data_url || style.logo_url) ? (
          <div className="rounded-lg bg-violet-50 border border-violet-100 px-3 py-2 text-xs text-violet-800">
            Logo enabled · {style.dark_color} on {style.light_color}
          </div>
        ) : null}

        {destination ? (
          <a
            href={destination}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Test destination
          </a>
        ) : null}
      </div>
    </div>
  );
}
