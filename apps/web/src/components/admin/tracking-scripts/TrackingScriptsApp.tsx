'use client';

import { useCallback, useEffect, useState } from 'react';
import { Code2, ExternalLink, FlaskConical, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import AdminPageRefresh from '@/components/admin/AdminPageRefresh';
import { newCustomScript, type CustomTrackingScript } from '@/lib/analytics/websiteTrackingScripts';

type PageOpt = { path: string; label: string };

type BuiltIn = {
  gtm_container_id: string;
  web_measurement_id: string;
  meta_pixel_id: string;
  openai_ads_pixel_id: string;
  clarity_project_id: string;
  gtm_enabled: boolean;
  gtag_enabled: boolean;
  meta_pixel_enabled: boolean;
  openai_ads_enabled: boolean;
  clarity_enabled: boolean;
};

type Snippets = {
  gtm_head: string;
  gtm_body: string;
  ga4: string;
  meta_pixel: string;
  openai_ads: string;
  clarity_note: string;
};

const EMPTY_BUILTIN: BuiltIn = {
  gtm_container_id: '',
  web_measurement_id: '',
  meta_pixel_id: '',
  openai_ads_pixel_id: 'U2kxzksZVZarMY9GCy9jJV',
  clarity_project_id: '',
  gtm_enabled: true,
  gtag_enabled: true,
  meta_pixel_enabled: true,
  openai_ads_enabled: true,
  clarity_enabled: true,
};

function SnippetBox({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
        <button
          type="button"
          className="text-[11px] font-semibold text-violet-700"
          onClick={() => void navigator.clipboard.writeText(value)}
        >
          Copy
        </button>
      </div>
      <textarea readOnly value={value} className="h-32 w-full rounded-lg border border-slate-200 bg-slate-50 p-2 font-mono text-[11px] text-slate-700" />
    </div>
  );
}

export default function TrackingScriptsApp() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [analytics, setAnalytics] = useState<BuiltIn>(EMPTY_BUILTIN);
  const [snippets, setSnippets] = useState<Snippets | null>(null);
  const [custom, setCustom] = useState<CustomTrackingScript[]>([]);
  const [pages, setPages] = useState<PageOpt[]>([]);
  const [testing, setTesting] = useState(false);
  const [testChecks, setTestChecks] = useState<Array<{ id: string; name: string; ok: boolean; message: string; detail?: string }>>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/super_admin/tracking-scripts');
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to load');
      setAnalytics({ ...EMPTY_BUILTIN, ...json.analytics });
      setSnippets(json.snippets || null);
      setCustom(Array.isArray(json.custom) ? json.custom : []);
      setPages(Array.isArray(json.pages) ? json.pages : []);
      setCanEdit(Boolean(json.can_edit));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const save = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch('/api/super_admin/tracking-scripts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analytics, custom }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Save failed');
      setMessage('Saved. Production website pe next page load pe apply hoga.');
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const patchCustom = (id: string, patch: Partial<CustomTrackingScript>) => {
    setCustom((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const runTest = async () => {
    setTesting(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch('/api/super_admin/tracking-scripts/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analytics, custom }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Test failed');
      setTestChecks(Array.isArray(json.checks) ? json.checks : []);
      setMessage(
        json.ok
          ? 'Test pass — IDs Google/Meta se load ho rahe hain. Live fire ke liye Open test page dabao.'
          : `${json.failed} check fail. Neeche list dekho.`,
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Test failed');
    } finally {
      setTesting(false);
    }
  };

  const togglePath = (id: string, path: string) => {
    setCustom((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const has = row.paths.includes(path);
        return { ...row, paths: has ? row.paths.filter((p) => p !== path) : [...row.paths, path] };
      }),
    );
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="border-b border-violet-100 bg-white/90">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-violet-600">Website tags</p>
            <h1 className="mt-0.5 text-2xl font-black text-slate-900">Tracking Scripts</h1>
            <p className="mt-1 text-sm text-slate-500">
              GTM / Pixel / GA4 jo already live hain yahan dikhte hain. Naya snippet Head ya Body mein paste karo — poori site ya selected pages.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void runTest()}
              disabled={testing || loading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-900 disabled:opacity-50"
            >
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
              Test IDs
            </button>
            <a
              href="/tracking-test"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-3 py-2 text-sm font-bold text-white"
            >
              <ExternalLink className="h-4 w-4" />
              Open test page
            </a>
            <AdminPageRefresh onClick={() => setRefreshKey((k) => k + 1)} />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
        {error ? <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
        {message ? <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p> : null}
        {testChecks.length > 0 ? (
          <div className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
            <p className="text-xs font-black uppercase tracking-wide text-amber-800">Test results</p>
            {testChecks.map((c) => (
              <div
                key={c.id}
                className={`rounded-lg border px-3 py-2 text-sm ${
                  c.ok ? 'border-emerald-200 bg-white text-emerald-900' : 'border-rose-200 bg-white text-rose-800'
                }`}
              >
                <span className="font-bold">{c.ok ? 'PASS' : 'FAIL'}</span> · {c.name} — {c.message}
                {c.detail ? <span className="block text-[11px] opacity-70">{c.detail}</span> : null}
              </div>
            ))}
          </div>
        ) : null}
        {loading ? (
          <div className="flex justify-center py-16 text-violet-600">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <>
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-black text-slate-900">
                <Code2 className="h-4 w-4 text-violet-600" /> Already live (built-in)
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-xs font-semibold text-slate-600">
                  GTM Container ID
                  <input
                    className="mt-1 w-full rounded-lg border px-3 py-2 font-mono text-sm"
                    value={analytics.gtm_container_id}
                    disabled={!canEdit}
                    onChange={(e) => setAnalytics((p) => ({ ...p, gtm_container_id: e.target.value }))}
                  />
                </label>
                <label className="text-xs font-semibold text-slate-600">
                  GA4 Measurement ID
                  <input
                    className="mt-1 w-full rounded-lg border px-3 py-2 font-mono text-sm"
                    value={analytics.web_measurement_id}
                    disabled={!canEdit}
                    onChange={(e) => setAnalytics((p) => ({ ...p, web_measurement_id: e.target.value }))}
                  />
                </label>
                <label className="text-xs font-semibold text-slate-600">
                  Meta Pixel ID
                  <input
                    className="mt-1 w-full rounded-lg border px-3 py-2 font-mono text-sm"
                    value={analytics.meta_pixel_id}
                    disabled={!canEdit}
                    onChange={(e) => setAnalytics((p) => ({ ...p, meta_pixel_id: e.target.value }))}
                  />
                </label>
                <label className="text-xs font-semibold text-slate-600">
                  OpenAI Ads Pixel ID
                  <input
                    className="mt-1 w-full rounded-lg border px-3 py-2 font-mono text-sm"
                    value={analytics.openai_ads_pixel_id}
                    disabled={!canEdit}
                    onChange={(e) => setAnalytics((p) => ({ ...p, openai_ads_pixel_id: e.target.value }))}
                  />
                </label>
                <label className="text-xs font-semibold text-slate-600">
                  Clarity Project ID
                  <input
                    className="mt-1 w-full rounded-lg border px-3 py-2 font-mono text-sm"
                    value={analytics.clarity_project_id}
                    disabled={!canEdit}
                    onChange={(e) => setAnalytics((p) => ({ ...p, clarity_project_id: e.target.value }))}
                  />
                </label>
              </div>
              <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-700">
                {(
                  [
                    ['gtm_enabled', 'GTM live'],
                    ['gtag_enabled', 'GA4 live'],
                    ['meta_pixel_enabled', 'Pixel live'],
                    ['openai_ads_enabled', 'OpenAI Ads live'],
                    ['clarity_enabled', 'Clarity (via GTM)'],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={Boolean(analytics[key])}
                      disabled={!canEdit}
                      onChange={(e) => setAnalytics((p) => ({ ...p, [key]: e.target.checked }))}
                    />
                    {label}
                  </label>
                ))}
              </div>
              {snippets ? (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <SnippetBox label="GTM — paste in Head" value={snippets.gtm_head} />
                  <SnippetBox label="GTM — paste in Body" value={snippets.gtm_body} />
                  <SnippetBox label="GA4 — Head" value={snippets.ga4} />
                  <SnippetBox label="Meta Pixel — Head" value={snippets.meta_pixel} />
                  <SnippetBox label="OpenAI Ads — Head (near top)" value={snippets.openai_ads} />
                </div>
              ) : null}
              {snippets ? <p className="mt-2 text-[11px] text-slate-500">{snippets.clarity_note}</p> : null}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-black text-slate-900">Custom snippets (Head / Body)</h2>
                <button
                  type="button"
                  disabled={!canEdit}
                  onClick={() => setCustom((prev) => [...prev, newCustomScript({ name: `Script ${prev.length + 1}` })])}
                  className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" /> Add snippet
                </button>
              </div>
              {custom.length === 0 ? (
                <p className="text-sm text-slate-400">Koi extra script nahi. Google/Meta ka full code yahan paste karo.</p>
              ) : (
                <div className="space-y-4">
                  {custom.map((row) => (
                    <div key={row.id} className="rounded-xl border border-slate-200 p-3">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <input
                          className="min-w-[160px] flex-1 rounded-lg border px-2 py-1.5 text-sm font-semibold"
                          value={row.name}
                          disabled={!canEdit}
                          onChange={(e) => patchCustom(row.id, { name: e.target.value })}
                        />
                        <select
                          className="rounded-lg border px-2 py-1.5 text-sm"
                          value={row.placement}
                          disabled={!canEdit}
                          onChange={(e) => patchCustom(row.id, { placement: e.target.value as 'head' | 'body' })}
                        >
                          <option value="head">Head</option>
                          <option value="body">Body</option>
                        </select>
                        <select
                          className="rounded-lg border px-2 py-1.5 text-sm"
                          value={row.scope}
                          disabled={!canEdit}
                          onChange={(e) => patchCustom(row.id, { scope: e.target.value as 'global' | 'pages' })}
                        >
                          <option value="global">All pages</option>
                          <option value="pages">Selected pages</option>
                        </select>
                        <select
                          className="rounded-lg border px-2 py-1.5 text-sm"
                          value={row.consent}
                          disabled={!canEdit}
                          onChange={(e) =>
                            patchCustom(row.id, { consent: e.target.value as CustomTrackingScript['consent'] })
                          }
                        >
                          <option value="analytics">After analytics cookie</option>
                          <option value="advertising">After ads cookie</option>
                          <option value="always">Always</option>
                        </select>
                        <label className="text-xs font-semibold text-slate-600">
                          <input
                            type="checkbox"
                            className="mr-1"
                            checked={row.enabled}
                            disabled={!canEdit}
                            onChange={(e) => patchCustom(row.id, { enabled: e.target.checked })}
                          />
                          On
                        </label>
                        <button
                          type="button"
                          disabled={!canEdit}
                          onClick={() => setCustom((prev) => prev.filter((s) => s.id !== row.id))}
                          className="rounded-lg p-1.5 text-rose-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      {row.scope === 'pages' ? (
                        <div className="mb-2">
                          <div className="mb-1 flex flex-wrap gap-2">
                            {pages.map((p) => (
                              <label key={p.path} className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]">
                                <input
                                  type="checkbox"
                                  checked={row.paths.includes(p.path)}
                                  disabled={!canEdit}
                                  onChange={() => togglePath(row.id, p.path)}
                                />
                                {p.label}
                              </label>
                            ))}
                          </div>
                          <input
                            className="w-full rounded-lg border px-2 py-1 text-xs"
                            placeholder="Extra path e.g. /car-service-in/pune"
                            disabled={!canEdit}
                            onBlur={(e) => {
                              const extra = e.target.value.trim();
                              if (!extra) return;
                              const path = extra.startsWith('/') ? extra : `/${extra}`;
                              if (!row.paths.includes(path)) patchCustom(row.id, { paths: [...row.paths, path] });
                              e.target.value = '';
                            }}
                          />
                        </div>
                      ) : null}
                      <textarea
                        className="h-40 w-full rounded-lg border border-slate-200 p-2 font-mono text-[12px]"
                        placeholder="<!-- Google Tag Manager --> paste full snippet here"
                        value={row.html}
                        disabled={!canEdit}
                        onChange={(e) => patchCustom(row.id, { html: e.target.value })}
                      />
                    </div>
                  ))}
                </div>
              )}
            </section>

            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={testing || loading}
                onClick={() => void runTest()}
                className="inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-bold text-amber-900 disabled:opacity-50"
              >
                {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
                Test
              </button>
              <button
                type="button"
                disabled={saving || !canEdit}
                onClick={() => void save()}
                className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save tracking scripts
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
