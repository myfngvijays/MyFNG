'use client';

import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { ArrowRight, Link2, Loader2, QrCode } from 'lucide-react';
import LinkPreviewPanel from '../LinkPreviewPanel';
import QrCustomizer from '../QrCustomizer';
import { DEFAULT_QR_STYLE, type QrStyleOptions } from '@/lib/link-manager/qr-types';
import { isValidHttpUrl, normalizeLongUrl } from '@/lib/link-manager/utils';

type Mode = 'link' | 'qr';

const EXPIRY_OPTIONS = [
  { value: 'never', label: 'Never expires' },
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
  { value: '365', label: '1 year' },
];

export default function CreateLinkSection({ onCreated }: { onCreated?: () => void }) {
  const [mode, setMode] = useState<Mode>('link');
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<any | null>(null);
  const [qrStyle, setQrStyle] = useState<QrStyleOptions>({ ...DEFAULT_QR_STYLE });
  const [form, setForm] = useState({
    long_url: '',
    title: '',
    custom_code: '',
    utm_source: '',
    utm_medium: '',
    utm_campaign: '',
    utm_term: '',
    utm_content: '',
    expires_option: 'never',
  });

  const expiresLabel = EXPIRY_OPTIONS.find((o) => o.value === form.expires_option)?.label || 'Never expires';
  const normalizedUrl = useMemo(() => normalizeLongUrl(form.long_url), [form.long_url]);
  const urlReady = Boolean(normalizedUrl && isValidHttpUrl(normalizedUrl));

  async function copyText(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error('Copy failed');
    }
  }

  async function handleCreate() {
    const longUrl = normalizeLongUrl(form.long_url);
    if (!longUrl) {
      toast.error('Paste a long URL first');
      return;
    }
    if (!isValidHttpUrl(longUrl)) {
      toast.error('Enter a valid http/https URL');
      return;
    }

    setCreating(true);
    try {
      const res = await fetch('/api/super_admin/link-manager', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          long_url: longUrl,
          create_mode: mode === 'qr' ? 'qr_only' : 'link_only',
          qr_style: mode === 'qr' ? qrStyle : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to create link');
      setCreated({ ...json.link, create_mode: mode === 'qr' ? 'qr_only' : 'link_only' });
      toast.success(mode === 'qr' ? 'QR code created' : 'Short link created');
    } catch (e: any) {
      toast.error(e?.message || 'Create failed');
    } finally {
      setCreating(false);
    }
  }

  function resetForm() {
    setCreated(null);
    setQrStyle({ ...DEFAULT_QR_STYLE });
    setForm({
      long_url: '',
      title: '',
      custom_code: '',
      utm_source: '',
      utm_medium: '',
      utm_campaign: '',
      utm_term: '',
      utm_content: '',
      expires_option: 'never',
    });
  }

  function switchMode(next: Mode) {
    setMode(next);
    setCreated(null);
  }

  return (
    <div className="w-full space-y-6">
      <div>
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
          {mode === 'link' ? 'Shorten a long URL' : 'Create a QR code'}
        </h2>
        <p className="text-gray-600 mt-1">
          {mode === 'link'
            ? 'Paste any long link and get a short myfng.in/s/… URL with click tracking.'
            : 'Generate a branded QR code. Scans go through your short link so destination stays editable.'}
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-6 items-start">
        <div className="w-full md:flex-1 md:min-w-0 rounded-2xl bg-white border border-gray-200 shadow-sm p-5 sm:p-6">
          <div className="inline-flex rounded-xl bg-gray-100 p-1 mb-5">
            <button
              type="button"
              onClick={() => switchMode('link')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${
                mode === 'link' ? 'bg-white shadow text-gray-900' : 'text-gray-500'
              }`}
            >
              <Link2 className="w-4 h-4" /> Only Short Link
            </button>
            <button
              type="button"
              onClick={() => switchMode('qr')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${
                mode === 'qr' ? 'bg-white shadow text-gray-900' : 'text-gray-500'
              }`}
            >
              <QrCode className="w-4 h-4" /> Only QR Code
            </button>
          </div>

          <label className="block text-sm font-semibold text-gray-800 mb-2">
            {mode === 'link' ? 'Long URL to shorten' : 'Destination URL (where QR should send users)'}
          </label>
          <input
            value={form.long_url}
            onChange={(e) => setForm((p) => ({ ...p, long_url: e.target.value }))}
            placeholder="https://example.com/my-very-long-url-with-many-parameters"
            className="w-full rounded-xl border border-gray-300 px-4 py-3.5 text-base focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
          />
          {form.long_url.trim() && !urlReady ? (
            <p className="text-xs text-amber-700 mt-2">Add a valid URL starting with http:// or https://</p>
          ) : null}
          {urlReady && normalizedUrl !== form.long_url.trim() ? (
            <p className="text-xs text-gray-500 mt-2 break-all">Will use: {normalizedUrl}</p>
          ) : null}

          <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/70 p-4">
            <p className="text-sm font-semibold text-blue-900 mb-3">
              {mode === 'link'
                ? 'Ready to shorten?'
                : 'Ready to generate QR?'}
            </p>
            <button
              type="button"
              disabled={creating || !urlReady}
              onClick={handleCreate}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold disabled:opacity-50"
            >
              {creating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : mode === 'qr' ? (
                <QrCode className="w-4 h-4" />
              ) : (
                <Link2 className="w-4 h-4" />
              )}
              {mode === 'qr' ? 'Generate QR code' : 'Shorten URL'}
              <ArrowRight className="w-4 h-4" />
            </button>
            <p className="text-xs text-blue-800/80 mt-2 leading-5">
              {mode === 'link'
                ? 'Creates only a short link — no QR image.'
                : 'Creates a QR PNG plus a hidden short link for tracking and future edits.'}
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-3 mt-5">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Title (optional)</label>
              <input
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="Campaign name"
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Custom back-half (optional)</label>
              <div className="flex rounded-xl border border-gray-300 overflow-hidden">
                <span className="px-3 py-2 text-xs text-gray-500 bg-gray-50 border-r">/s/</span>
                <input
                  value={form.custom_code}
                  onChange={(e) => setForm((p) => ({ ...p, custom_code: e.target.value }))}
                  placeholder="my-offer"
                  className="flex-1 px-3 py-2 text-sm outline-none"
                />
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm font-semibold text-gray-800 mb-3">UTM parameters (optional)</p>
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                ['utm_source', 'Source'],
                ['utm_medium', 'Medium'],
                ['utm_campaign', 'Campaign'],
                ['utm_term', 'Term'],
                ['utm_content', 'Content'],
              ].map(([key, label]) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                  <input
                    value={(form as any)[key]}
                    onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                    placeholder={String(label)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                  />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Link expiry</label>
                <select
                  value={form.expires_option}
                  onChange={(e) => setForm((p) => ({ ...p, expires_option: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                >
                  {EXPIRY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {mode === 'qr' ? <QrCustomizer value={qrStyle} onChange={setQrStyle} /> : null}

          {created ? (
            <div className="mt-5 flex flex-wrap gap-2">
              <button type="button" onClick={resetForm} className="px-4 py-3 rounded-xl border font-semibold text-sm">
                Create another
              </button>
              <button
                type="button"
                onClick={() => onCreated?.()}
                className="px-4 py-3 rounded-xl border border-blue-200 text-blue-700 font-semibold text-sm"
              >
                View all links
              </button>
            </div>
          ) : null}
        </div>

        <aside className="w-full md:w-[360px] md:shrink-0 md:sticky md:top-4 self-start">
          <LinkPreviewPanel
            form={{ ...form, expires_label: expiresLabel }}
            mode={mode}
            qrStyle={qrStyle}
            created={created}
            onCopy={copyText}
          />
        </aside>
      </div>
    </div>
  );
}
