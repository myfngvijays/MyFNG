'use client';

import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FileText,
  Globe,
  Info,
  MapPin,
  Newspaper,
  Settings2,
  Store,
  XCircle,
} from 'lucide-react';
import { seoAdminTheme as t } from '@/components/admin/site-seo/seo-admin-theme';

export type SeoOverviewData = {
  health_score: number;
  issues: Array<{ severity: 'error' | 'warning' | 'info'; message: string; tab?: string }>;
  counts: {
    managed_total: number;
    static_pages: number;
    service_pages: number;
    city_pages: number;
    workshops_total: number;
    workshops_noindex: number;
    blogs_total: number;
    blogs_noindex: number;
    sitemap_total: number;
    pages_noindex: number;
    pages_inactive: number;
    live_files_custom: number;
  };
  verification: { google: boolean; bing: boolean };
  links: {
    sitemap_url: string;
    robots_url: string;
    manifest_url: string;
    llms_txt_url: string;
    rss_feed_url: string;
  };
  attention_pages: Array<{
    id: string;
    page_label: string;
    page_path: string;
    title_length: number;
    description_length: number;
    noindex: boolean;
  }>;
};

type Props = {
  data: SeoOverviewData | null;
  loading?: boolean;
  onOpenTab?: (tab: string) => void;
  onSelectPage?: (id: string) => void;
};

function StatCard({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'default' | 'green' | 'amber' | 'blue';
}) {
  const toneClass =
    tone === 'blue' ? t.stat.blue : tone === 'green' ? t.stat.green : tone === 'amber' ? t.stat.amber : t.stat.default;
  return (
    <div className={toneClass}>
      <p className={t.sectionTitle}>{label}</p>
      <p className={t.statValue}>{value}</p>
      {hint ? <p className={`mt-1 ${t.hint}`}>{hint}</p> : null}
    </div>
  );
}

function IssueIcon({ severity }: { severity: 'error' | 'warning' | 'info' }) {
  if (severity === 'error') return <XCircle className="h-4 w-4 text-red-500" />;
  if (severity === 'warning') return <AlertTriangle className="h-4 w-4 text-amber-500" />;
  return <Info className="h-4 w-4 text-sky-500" />;
}

export default function SeoOverviewDashboard({ data, loading, onOpenTab, onSelectPage }: Props) {
  if (loading) {
    return <div className={`${t.card} p-10 text-center text-sm ${t.subtitle}`}>Loading SEO overview…</div>;
  }

  if (!data) {
    return <div className={`${t.cardMuted} p-10 text-center text-sm ${t.subtitle}`}>Could not load SEO overview.</div>;
  }

  const scoreTone =
    data.health_score >= 85 ? t.scoreGood : data.health_score >= 65 ? t.scoreMid : t.scoreBad;

  return (
    <div className="space-y-6">
      <section className={`${t.card} p-5`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className={`flex items-center gap-2 text-sm font-semibold ${t.label}`}>
              <Globe className={`h-4 w-4 ${t.iconAccent}`} />
              SEO Health Overview
            </div>
            <p className={`mt-1 text-sm ${t.subtitle}`}>
              Snapshot of managed pages, sitemap coverage, verification and items needing attention.
            </p>
          </div>
          <div className={t.scoreBox}>
            <p className={t.sectionTitle}>Health score</p>
            <p className={`text-4xl font-black ${scoreTone}`}>{data.health_score}</p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Sitemap URLs" value={data.counts.sitemap_total} hint="Pages in sitemap.xml" tone="blue" />
        <StatCard
          label="Managed Pages"
          value={data.counts.managed_total}
          hint={`${data.counts.static_pages} static · ${data.counts.service_pages} service · ${data.counts.city_pages} city`}
        />
        <StatCard
          label="Workshops"
          value={data.counts.workshops_total}
          hint={`${data.counts.workshops_noindex} noindex`}
          tone="green"
        />
        <StatCard label="Blogs" value={data.counts.blogs_total} hint={`${data.counts.blogs_noindex} noindex`} tone="green" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className={`${t.card} p-5`}>
          <h3 className={t.sectionTitle}>Verification & Status</h3>
          <div className="mt-4 flex flex-wrap gap-2">
            <span
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ring-1 ${
                data.verification.google
                  ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                  : 'bg-amber-50 text-amber-700 ring-amber-200'
              }`}
            >
              {data.verification.google ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
              Google {data.verification.google ? 'Connected' : 'Missing'}
            </span>
            <span
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ring-1 ${
                data.verification.bing
                  ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                  : 'bg-amber-50 text-amber-700 ring-amber-200'
              }`}
            >
              {data.verification.bing ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
              Bing {data.verification.bing ? 'Connected' : 'Missing'}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 ring-1 ring-slate-200">
              <FileText className="h-3.5 w-3.5" />
              {data.counts.live_files_custom} custom live file(s)
            </span>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {[
              { label: 'Sitemap', url: data.links.sitemap_url },
              { label: 'Robots.txt', url: data.links.robots_url },
              { label: 'RSS Feed', url: data.links.rss_feed_url },
              { label: 'llms.txt', url: data.links.llms_txt_url },
            ].map((item) => (
              <a key={item.url} href={item.url} target="_blank" rel="noreferrer" className={t.linkCard}>
                {item.label}
                <ExternalLink className="h-4 w-4 text-slate-500" />
              </a>
            ))}
          </div>
        </section>

        <section className={`${t.card} p-5`}>
          <h3 className={t.sectionTitle}>Issues & Alerts</h3>
          <div className="mt-4 space-y-2">
            {data.issues.length === 0 ? (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm font-semibold text-emerald-800">
                <CheckCircle2 className="h-4 w-4" />
                No major SEO issues detected.
              </div>
            ) : (
              data.issues.map((issue, index) => (
                <div key={`${issue.message}-${index}`} className={t.issueRow}>
                  <div className="flex items-start gap-2">
                    <IssueIcon severity={issue.severity} />
                    <p className={`text-sm ${t.body}`}>{issue.message}</p>
                  </div>
                  {issue.tab && onOpenTab ? (
                    <button
                      type="button"
                      onClick={() => onOpenTab(issue.tab!)}
                      className={t.fixLink}
                    >
                      Fix
                    </button>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <section className={`${t.card} p-5`}>
          <h3 className={t.sectionTitle}>Pages Needing Attention</h3>
          {data.attention_pages.length === 0 ? (
            <p className={`mt-4 text-sm ${t.subtitle}`}>All managed pages look good on title and description length.</p>
          ) : (
            <div className="mt-4 space-y-2">
              {data.attention_pages.map((page) => (
                <button
                  key={page.id}
                  type="button"
                  onClick={() => onSelectPage?.(page.id)}
                  className={t.attentionRow}
                >
                  <div>
                    <p className={t.listTitle}>{page.page_label}</p>
                    <p className={`text-xs ${t.subtitle}`}>{page.page_path}</p>
                  </div>
                  <div className="text-right text-xs font-semibold">
                    <p className={page.title_length > 60 ? t.charMid : t.subtitle}>
                      Title {page.title_length}/60
                    </p>
                    <p className={page.description_length > 160 ? t.charMid : t.subtitle}>
                      Desc {page.description_length}/160
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className={`${t.card} p-5`}>
          <h3 className={t.sectionTitle}>Quick Actions</h3>
          <div className="mt-4 space-y-2">
            {[
              { tab: 'all', label: 'Edit page SEO', icon: FileText },
              { tab: 'technical', label: 'Technical SEO settings', icon: Settings2 },
              { tab: 'workshop', label: 'Workshop SEO preview', icon: Store },
              { tab: 'blog', label: 'Blog SEO preview', icon: Newspaper },
              { tab: 'city', label: 'City landing pages', icon: MapPin },
            ].map((action) => (
              <button
                key={action.tab}
                type="button"
                onClick={() => onOpenTab?.(action.tab)}
                className={`flex w-full items-center gap-3 ${t.linkCard}`}
              >
                <action.icon className={`h-4 w-4 ${t.iconAccent}`} />
                {action.label}
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
