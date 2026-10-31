'use client';

import { useCallback, useEffect, useState } from 'react';
import { Megaphone, Save } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { DEFAULT_WEBSITE_OFFER_POPUP, type WebsiteOfferPopupConfig } from '@/lib/website-offer-popup';

const FIELDS: Array<{ key: keyof WebsiteOfferPopupConfig; label: string; type?: string }> = [
  { key: 'headline', label: 'Headline' },
  { key: 'subtitle', label: 'Line under headline' },
  { key: 'coupon_code', label: 'Coupon code' },
  { key: 'offer_label', label: 'Offer label' },
  { key: 'badge_text', label: 'Badge' },
  { key: 'button_text', label: 'Button text' },
  { key: 'button_href', label: 'Button page' },
  { key: 'image_url', label: 'Banner image' },
  { key: 'utm_source', label: 'UTM source' },
  { key: 'utm_medium', label: 'UTM medium' },
  { key: 'utm_campaign', label: 'UTM campaign' },
  { key: 'max_views', label: 'Show times per browser', type: 'number' },
];

export default function WebsitePopupAdmin() {
  const [config, setConfig] = useState<WebsiteOfferPopupConfig>(DEFAULT_WEBSITE_OFFER_POPUP);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/super_admin/website-popup', { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to load popup');
      setConfig({ ...DEFAULT_WEBSITE_OFFER_POPUP, ...json.config });
    } catch (error: any) {
      toast.error(error?.message || 'Could not load popup');
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
      const res = await fetch('/api/super_admin/website-popup', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Save failed');
      setConfig({ ...DEFAULT_WEBSITE_OFFER_POPUP, ...json.config });
      toast.success('Website popup saved');
    } catch (error: any) {
      toast.error(error?.message || 'Could not save popup');
    } finally {
      setSaving(false);
    }
  };

  const set = (key: keyof WebsiteOfferPopupConfig, value: string | boolean | number) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Megaphone className="h-4 w-4" />
              Website
            </div>
            <h1 className="mt-1 text-2xl font-bold text-gray-900">Website popup</h1>
            <p className="mt-1 text-sm text-gray-500">Diwali offer popup. Turn it off, or set when it starts and expires.</p>
          </div>
          <button
            type="button"
            onClick={save}
            disabled={loading || saving}
            className="inline-flex items-center gap-2 rounded-lg bg-[#6b1224] px-4 py-2 text-sm font-semibold text-[#ffe14a] disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-3xl space-y-4 px-4 py-6 sm:px-6">
        <label className="flex items-center justify-between rounded-xl border bg-white px-4 py-3">
          <span className="text-sm font-semibold text-gray-900">Popup on</span>
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => set('enabled', e.target.checked)}
            className="h-5 w-5 accent-[#6b1224]"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block rounded-xl border bg-white px-4 py-3">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-500">Start</span>
            <input
              type="datetime-local"
              value={config.starts_at}
              onChange={(e) => set('starts_at', e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
          </label>
          <label className="block rounded-xl border bg-white px-4 py-3">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-500">Expiry</span>
            <input
              type="datetime-local"
              value={config.ends_at}
              onChange={(e) => set('ends_at', e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {FIELDS.map((field) => (
            <label key={field.key} className="block rounded-xl border bg-white px-4 py-3">
              <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-500">{field.label}</span>
              <input
                type={field.type || 'text'}
                value={String(config[field.key] ?? '')}
                onChange={(e) =>
                  set(field.key, field.type === 'number' ? Number(e.target.value) : e.target.value)
                }
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
