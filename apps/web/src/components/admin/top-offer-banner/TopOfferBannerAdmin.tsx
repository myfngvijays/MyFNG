'use client';

import { useCallback, useEffect, useState } from 'react';
import { Megaphone, Save } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { DEFAULT_TOP_OFFER_BANNER, type TopOfferBannerConfig } from '@/lib/top-offer-banner';

const COLORS: Array<{ key: keyof TopOfferBannerConfig; label: string }> = [
  { key: 'background_from', label: 'Banner start' },
  { key: 'background_via', label: 'Banner middle' },
  { key: 'background_to', label: 'Banner end' },
  { key: 'text_color', label: 'Headline' },
  { key: 'offer_color', label: 'Offer label' },
  { key: 'button_background', label: 'Button background' },
  { key: 'button_text', label: 'Button text' },
];

export default function TopOfferBannerAdmin() {
  const [config, setConfig] = useState<TopOfferBannerConfig>(DEFAULT_TOP_OFFER_BANNER);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/super_admin/top-offer-banner', { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to load banner');
      setConfig({ ...DEFAULT_TOP_OFFER_BANNER, ...json.config });
    } catch (error: any) {
      toast.error(error?.message || 'Could not load banner');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/super_admin/top-offer-banner', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Save failed');
      setConfig({ ...DEFAULT_TOP_OFFER_BANNER, ...json.config });
      toast.success('Top offer banner saved');
    } catch (error: any) {
      toast.error(error?.message || 'Could not save banner');
    } finally {
      setSaving(false);
    }
  };

  const set = (key: keyof TopOfferBannerConfig, value: string | boolean) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Megaphone className="h-4 w-4" />
              Website
            </div>
            <h1 className="mt-1 text-2xl font-bold text-gray-900">Top offer banner</h1>
            <p className="mt-1 text-sm text-gray-500">Text and colors on the strip above the website header.</p>
          </div>
          <button
            type="button"
            onClick={save}
            disabled={loading || saving}
            className="inline-flex items-center gap-2 rounded-lg bg-[#023D95] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6">
        <div
          className="overflow-hidden rounded-xl text-sm font-bold"
          style={{
            background: `linear-gradient(to right, ${config.background_from}, ${config.background_via}, ${config.background_to})`,
            color: config.text_color,
          }}
        >
          <div className="flex flex-wrap items-center justify-center gap-3 px-4 py-3">
            <span>{config.headline}</span>
            <span style={{ color: config.offer_color }}>{config.offer_label}</span>
            {config.show_countdown ? <span className="rounded bg-white/25 px-2 py-0.5 text-xs">00 : 00 : 00</span> : null}
            <span
              className="rounded-md px-3 py-1.5 text-xs"
              style={{ background: config.button_background, color: config.button_text }}
            >
              {config.button_label}
            </span>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-5">
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-800">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(event) => set('enabled', event.target.checked)}
            />
            Show banner on the website
          </label>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block text-sm sm:col-span-2">
              <span className="font-medium text-gray-700">Headline</span>
              <input
                value={config.headline}
                onChange={(event) => set('headline', event.target.value)}
                className="mt-1 w-full rounded-lg border px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-gray-700">Offer label</span>
              <input
                value={config.offer_label}
                onChange={(event) => set('offer_label', event.target.value)}
                className="mt-1 w-full rounded-lg border px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-gray-700">Button text</span>
              <input
                value={config.button_label}
                onChange={(event) => set('button_label', event.target.value)}
                className="mt-1 w-full rounded-lg border px-3 py-2"
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="font-medium text-gray-700">Button link</span>
              <input
                value={config.button_href}
                onChange={(event) => set('button_href', event.target.value)}
                className="mt-1 w-full rounded-lg border px-3 py-2"
              />
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-800">
              <input
                type="checkbox"
                checked={config.show_countdown}
                onChange={(event) => set('show_countdown', event.target.checked)}
              />
              Show end-of-day countdown
            </label>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-5">
          <h2 className="text-sm font-semibold text-gray-900">Colors</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {COLORS.map((item) => (
              <label key={item.key} className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium text-gray-700">{item.label}</span>
                <span className="flex items-center gap-2">
                  <input
                    type="color"
                    value={String(config[item.key]).length === 7 ? String(config[item.key]) : '#000000'}
                    onChange={(event) => set(item.key, event.target.value)}
                    className="h-9 w-12 cursor-pointer rounded border bg-white"
                  />
                  <input
                    value={String(config[item.key])}
                    onChange={(event) => set(item.key, event.target.value)}
                    className="w-28 rounded-lg border px-2 py-1.5 font-mono text-xs"
                  />
                </span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
