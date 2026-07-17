'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  FileText,
  Globe,
  RefreshCw,
  Save,
  Settings2,
  Shield,
  Smartphone,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import LiveFilesEditor from '@/components/admin/site-seo/LiveFilesEditor';
import { seoAdminTheme as t } from '@/components/admin/site-seo/seo-admin-theme';
import type { SiteTechnicalSeoRow, TechnicalSeoOverview } from '@/lib/site-technical-seo';

function CharCount({ value, ideal }: { value: string; ideal: number }) {
  const len = value.length;
  const tone = len === 0 ? t.hint : len <= ideal ? t.charGood : len <= ideal + 20 ? t.charMid : t.charBad;
  return <span className={`text-xs font-semibold ${tone}`}>{len} / {ideal}</span>;
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <span className={t.label}>{label}</span>
        {hint ? <span className={t.hint}>{hint}</span> : null}
      </div>
      {children}
    </label>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className={t.stat.default}>
      <p className={t.sectionTitle}>{label}</p>
      <p className={t.statValueSm}>{value}</p>
    </div>
  );
}

type Props = {
  onRefreshAll?: () => Promise<void>;
};

export default function TechnicalSeoPanel({ onRefreshAll }: Props) {
  const [draft, setDraft] = useState<SiteTechnicalSeoRow | null>(null);
  const [overview, setOverview] = useState<TechnicalSeoOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/super_admin/site-seo/technical', { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || json?.details || json?.hint || 'Failed to load technical SEO');
      setDraft(json.data as SiteTechnicalSeoRow);
      setOverview(json.overview as TechnicalSeoOverview);
    } catch (err: any) {
      toast.error(err?.message || 'Could not load technical SEO');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const res = await fetch('/api/super_admin/site-seo/technical', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || json?.details || json?.hint || 'Save failed');
      setDraft(json.data as SiteTechnicalSeoRow);
      setOverview(json.overview as TechnicalSeoOverview);
      toast.success('Technical SEO saved');
      await onRefreshAll?.();
    } catch (err: any) {
      toast.error(err?.message || 'Could not save technical SEO');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className={`${t.card} p-10 text-center text-sm ${t.subtitle}`}>Loading technical SEO…</div>;
  }

  if (!draft) {
    return (
      <div className={`${t.cardMuted} p-10 text-center text-sm ${t.subtitle}`}>
        Technical SEO settings unavailable. Run migration `database/273_site_technical_seo.sql`.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className={`flex items-center gap-2 text-sm font-semibold ${t.label}`}>
            <Settings2 className={`h-4 w-4 ${t.iconAccent}`} />
            Site-wide technical SEO
          </div>
          <p className={`mt-1 text-sm ${t.subtitle}`}>
            Controls robots.txt extras, manifest, verification tags, default OG/Twitter and organization schema links.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => load()} disabled={loading || saving} className={t.btnGhost}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button type="button" onClick={save} disabled={saving} className={t.btnPrimary}>
            <Save className="h-4 w-4" />
            {saving ? 'Saving…' : 'Save Technical SEO'}
          </button>
        </div>
      </div>

      {overview ? (
        <div className="grid gap-4 md:grid-cols-4">
          <StatCard label="Sitemap URLs" value={overview.url_counts.total} />
          <StatCard label="Static + Service + City" value={overview.url_counts.site_pages} />
          <StatCard label="Workshops" value={overview.url_counts.workshops} />
          <StatCard label="Blogs" value={overview.url_counts.blogs} />
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <section className={`${t.card} p-5`}>
          <div className="mb-4 flex items-center gap-2">
            <Globe className={`h-4 w-4 ${t.iconAccent}`} />
            <h3 className={t.sectionTitle}>Search Console Verification</h3>
          </div>
          <div className="grid gap-4">
            <Field label="Google verification token">
              <input
                value={draft.google_verification}
                onChange={(e) => setDraft((prev) => (prev ? { ...prev, google_verification: e.target.value } : prev))}
                placeholder="Paste content value from Google Search Console"
                className={t.input}
              />
            </Field>
            <Field label="Bing verification token">
              <input
                value={draft.bing_verification}
                onChange={(e) => setDraft((prev) => (prev ? { ...prev, bing_verification: e.target.value } : prev))}
                placeholder="msvalidate.01 content value"
                className={t.input}
              />
            </Field>
            <Field label="Yandex verification token">
              <input
                value={draft.yandex_verification}
                onChange={(e) => setDraft((prev) => (prev ? { ...prev, yandex_verification: e.target.value } : prev))}
                className={t.input}
              />
            </Field>
          </div>
        </section>

        <section className={`${t.card} p-5`}>
          <div className="mb-4 flex items-center gap-2">
            <FileText className={`h-4 w-4 ${t.iconAccent}`} />
            <h3 className={t.sectionTitle}>Default Site Meta</h3>
          </div>
          <div className="grid gap-4">
            <Field label="Default title" hint={<CharCount value={draft.default_title} ideal={60} />}>
              <input
                value={draft.default_title}
                onChange={(e) => setDraft((prev) => (prev ? { ...prev, default_title: e.target.value } : prev))}
                className={t.input}
              />
            </Field>
            <Field label="Default description" hint={<CharCount value={draft.default_description} ideal={160} />}>
              <textarea
                value={draft.default_description}
                onChange={(e) => setDraft((prev) => (prev ? { ...prev, default_description: e.target.value } : prev))}
                rows={4}
                className={t.textarea}
              />
            </Field>
            <Field label="Twitter @site">
              <input
                value={draft.twitter_site}
                onChange={(e) => setDraft((prev) => (prev ? { ...prev, twitter_site: e.target.value } : prev))}
                placeholder="@myfngcarservice"
                className={t.input}
              />
            </Field>
          </div>
        </section>

        <section className={`${t.card} p-5`}>
          <div className="mb-4 flex items-center gap-2">
            <Smartphone className={`h-4 w-4 ${t.iconAccent}`} />
            <h3 className={t.sectionTitle}>PWA Manifest</h3>
          </div>
          <div className="grid gap-4">
            <Field label="App name">
              <input
                value={draft.manifest_name}
                onChange={(e) => setDraft((prev) => (prev ? { ...prev, manifest_name: e.target.value } : prev))}
                className={t.input}
              />
            </Field>
            <Field label="Short name">
              <input
                value={draft.manifest_short_name}
                onChange={(e) => setDraft((prev) => (prev ? { ...prev, manifest_short_name: e.target.value } : prev))}
                className={t.input}
              />
            </Field>
            <Field label="Manifest description">
              <textarea
                value={draft.manifest_description}
                onChange={(e) => setDraft((prev) => (prev ? { ...prev, manifest_description: e.target.value } : prev))}
                rows={3}
                className={t.textarea}
              />
            </Field>
            <Field label="Theme color">
              <input
                value={draft.theme_color}
                onChange={(e) => setDraft((prev) => (prev ? { ...prev, theme_color: e.target.value } : prev))}
                placeholder="#dc2626"
                className={t.input}
              />
            </Field>
          </div>
        </section>

        <section className={`${t.card} p-5`}>
          <div className="mb-4 flex items-center gap-2">
            <Shield className={`h-4 w-4 ${t.iconAccent}`} />
            <h3 className={t.sectionTitle}>Crawl & Schema</h3>
          </div>
          <div className="grid gap-4">
            <Field label="Organization social profiles" hint="One URL per line (sameAs)">
              <textarea
                value={draft.organization_same_as}
                onChange={(e) => setDraft((prev) => (prev ? { ...prev, organization_same_as: e.target.value } : prev))}
                rows={6}
                className={t.textarea}
              />
            </Field>
            <Field label="Extra robots.txt disallow paths" hint="One path per line, e.g. /private/">
              <textarea
                value={draft.extra_robots_disallow}
                onChange={(e) => setDraft((prev) => (prev ? { ...prev, extra_robots_disallow: e.target.value } : prev))}
                rows={4}
                placeholder="/legacy-page"
                className={t.textarea}
              />
            </Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Security.txt email">
                <input
                  value={draft.security_contact_email}
                  onChange={(e) => setDraft((prev) => (prev ? { ...prev, security_contact_email: e.target.value } : prev))}
                  className={t.input}
                />
              </Field>
              <Field label="Security.txt phone">
                <input
                  value={draft.security_contact_phone}
                  onChange={(e) => setDraft((prev) => (prev ? { ...prev, security_contact_phone: e.target.value } : prev))}
                  className={t.input}
                />
              </Field>
            </div>
            <Field label="Internal notes">
              <textarea
                value={draft.notes}
                onChange={(e) => setDraft((prev) => (prev ? { ...prev, notes: e.target.value } : prev))}
                rows={2}
                className={t.textarea}
              />
            </Field>
          </div>
        </section>
      </div>

      <LiveFilesEditor />

      {overview ? (
        <section className={`${t.card} p-5`}>
          <h3 className={t.sectionTitle}>Auto-managed Rules</h3>
          <p className={`mt-2 text-sm ${t.subtitle}`}>
            Blog RSS feed:{' '}
            <a href={overview.rss_feed_url} target="_blank" rel="noreferrer" className={`font-semibold ${t.fixLink}`}>
              {overview.rss_feed_url}
            </a>
          </p>
          <div className="mt-4 space-y-4 text-sm">
            <div>
              <p className={t.label}>Robots disallow (built-in)</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {overview.robots_disallow.map((path) => (
                  <span key={path} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                    {path}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <p className={t.label}>Utility pages (noindex)</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {overview.utility_noindex.map((path) => (
                  <span key={path} className={t.badge.noindex}>
                    {path}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <p className={t.label}>JSON-LD coverage</p>
              <div className="mt-2 space-y-2">
                {overview.json_ld_pages.map((row) => (
                  <div key={row.label} className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                    <span className={`font-semibold ${t.label}`}>{row.label}</span>
                    <span className={`text-right text-xs ${t.subtitle}`}>{row.schema}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
