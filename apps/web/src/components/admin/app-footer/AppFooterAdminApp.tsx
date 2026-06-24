'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { PanelBottom, RefreshCw, Save, Smartphone } from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  DEFAULT_APP_FOOTER_CONFIG,
  type AppFooterConfig,
} from '@/lib/app-footer-config';

export default function AppFooterAdminApp() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<AppFooterConfig>(DEFAULT_APP_FOOTER_CONFIG);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/super_admin/app-footer', { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to load footer settings');
      setConfig(normalizeLocalConfig(json.config));
    } catch (err: any) {
      toast.error(err?.message || 'Could not load app footer settings');
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
      const res = await fetch('/api/super_admin/app-footer', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Save failed');
      setConfig(normalizeLocalConfig(json.config));
      toast.success('App footer content saved');
    } catch (err: any) {
      toast.error(err?.message || 'Could not save footer content');
    } finally {
      setSaving(false);
    }
  };

  const updateStat = (index: 0 | 1, field: 'value' | 'label', value: string) => {
    setConfig((prev) => {
      const stats = [...prev.stats] as AppFooterConfig['stats'];
      stats[index] = { ...stats[index], [field]: value };
      return { ...prev, stats };
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Smartphone className="h-4 w-4" />
              Mobile App
            </div>
            <h1 className="mt-1 text-2xl font-black text-gray-900">App Footer Content</h1>
            <p className="mt-1 max-w-2xl text-sm text-gray-600">
              Edit the footer shown at the bottom of Home, Cart, Services and other app screens.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => load()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving || loading}
              className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Saving…' : 'Save Footer'}
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-5xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[1fr_320px]">
        <section className="space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-black uppercase tracking-wide text-gray-500">Headline</h2>
            <div className="mt-4 space-y-4">
              <Field
                label="Line 1"
                value={config.headline_line1}
                onChange={(value) => setConfig((prev) => ({ ...prev, headline_line1: value }))}
                maxLength={80}
              />
              <Field
                label="Line 2"
                value={config.headline_line2}
                onChange={(value) => setConfig((prev) => ({ ...prev, headline_line2: value }))}
                maxLength={80}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-black uppercase tracking-wide text-gray-500">Stats (2 columns)</h2>
            <p className="mt-1 text-xs text-gray-500">Two center stats shown side by side in the app footer.</p>
            <div className="mt-4 space-y-5">
              {config.stats.map((stat, index) => (
                <div key={index} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                  <div className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-500">
                    Column {index + 1}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field
                      label="Number / value"
                      value={stat.value}
                      onChange={(value) => updateStat(index as 0 | 1, 'value', value)}
                      maxLength={24}
                    />
                    <Field
                      label="Label"
                      value={stat.label}
                      onChange={(value) => updateStat(index as 0 | 1, 'label', value)}
                      maxLength={40}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-black uppercase tracking-wide text-gray-500">Bottom line</h2>
            <p className="mt-1 text-xs text-gray-500">
              Single line shown below the two stats (e.g. 100+ A-GRADE MULTIBRAND WORKSHOPS).
            </p>
            <div className="mt-4">
              <Field
                label="Bottom text"
                value={config.bottom_line}
                onChange={(value) => setConfig((prev) => ({ ...prev, bottom_line: value }))}
                maxLength={80}
              />
            </div>
          </div>
        </section>

        <aside>
          <div className="sticky top-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-gray-500">
              <PanelBottom className="h-4 w-4" />
              Mobile preview
            </div>
            <div className="mt-4 rounded-2xl bg-[#F4F7FB] px-4 py-5 opacity-90">
              <p className="text-center text-[18px] font-bold leading-[26px] text-[#9CA3AF]">
                {config.headline_line1}
                <br />
                {config.headline_line2}
              </p>
              <div className="mt-4 flex items-center justify-center gap-5">
                {config.stats.map((stat, index) => (
                  <React.Fragment key={index}>
                    {index > 0 ? <div className="h-[34px] w-px bg-[#B6C0CC]" /> : null}
                    <div className="text-center">
                      <div className="text-[11px] font-bold text-[rgba(0,74,173,0.58)]">{stat.value}</div>
                      <div className="mt-0.5 text-[10px] font-semibold uppercase text-[#A8B0BC]">{stat.label}</div>
                    </div>
                  </React.Fragment>
                ))}
              </div>
              {config.bottom_line ? (
                <p className="mt-3 text-center text-[10px] font-semibold uppercase tracking-wide text-[#A8B0BC]">
                  {config.bottom_line}
                </p>
              ) : null}
            </div>
            <p className="mt-3 text-xs leading-5 text-gray-500">
              Changes apply to all app screens using the shared footer after users refresh or reopen the app.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function normalizeLocalConfig(raw: any): AppFooterConfig {
  const base = DEFAULT_APP_FOOTER_CONFIG;
  const stats = Array.isArray(raw?.stats) ? raw.stats : base.stats;
  const legacyBottom =
    stats[2]?.value || stats[2]?.label
      ? `${stats[2]?.value || ''} ${String(stats[2]?.label || '').replace(/\n/g, ' ')}`.trim()
      : '';
  return {
    headline_line1: String(raw?.headline_line1 || base.headline_line1).trim() || base.headline_line1,
    headline_line2: String(raw?.headline_line2 || base.headline_line2).trim() || base.headline_line2,
    stats: [0, 1].map((i) => ({
      value: String(stats[i]?.value || base.stats[i as 0 | 1].value).trim() || base.stats[i as 0 | 1].value,
      label: String(stats[i]?.label || base.stats[i as 0 | 1].label).trim() || base.stats[i as 0 | 1].label,
    })) as AppFooterConfig['stats'],
    bottom_line:
      String(raw?.bottom_line || legacyBottom || base.bottom_line).trim() || base.bottom_line,
  };
}

function Field({
  label,
  value,
  onChange,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-gray-900">{label}</span>
      <input
        value={value}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100"
      />
    </label>
  );
}
