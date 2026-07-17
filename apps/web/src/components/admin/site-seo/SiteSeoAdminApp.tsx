'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink, Globe, RefreshCw, Save, Search, Sparkles, Store } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { SITE_URL } from '@/lib/seo/metadata';
import { classifySitePagePath } from '@/lib/site-page-seo';
import type { SitePageSeoRow } from '@/lib/site-page-seo';
import type { BlogSeoSummary } from '@/lib/blog/seo';
import type { WorkshopSeoSummary } from '@/lib/workshop-page-seo';
import TechnicalSeoPanel from '@/components/admin/site-seo/TechnicalSeoPanel';
import SeoOverviewDashboard, { type SeoOverviewData } from '@/components/admin/site-seo/SeoOverviewDashboard';
import { seoAdminTheme as t } from '@/components/admin/site-seo/seo-admin-theme';

type SeoTab = 'overview' | 'all' | 'static' | 'service' | 'city' | 'workshop' | 'blog' | 'technical';

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

const TAB_META: Record<SeoTab, { label: string; subtitle: string }> = {
  overview: { label: 'Overview', subtitle: 'SEO health dashboard, sitemap stats and action items' },
  all: { label: 'All Pages', subtitle: 'Static + service detail pages' },
  static: { label: 'Static Pages', subtitle: 'Home, About, Book Service, etc.' },
  service: { label: 'Service Pages', subtitle: '/car-services/* detail pages' },
  workshop: { label: 'Workshops', subtitle: 'Published workshop public pages' },
  city: { label: 'City Pages', subtitle: 'Car service landing pages by city' },
  blog: { label: 'Blogs', subtitle: 'Published blog posts (read-only preview)' },
  technical: { label: 'Technical SEO', subtitle: 'Verification, manifest, robots, schema & crawl settings' },
};

export default function SiteSeoAdminApp() {
  const [rows, setRows] = useState<SitePageSeoRow[]>([]);
  const [workshops, setWorkshops] = useState<WorkshopSeoSummary[]>([]);
  const [blogs, setBlogs] = useState<BlogSeoSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [workshopsLoading, setWorkshopsLoading] = useState(false);
  const [blogsLoading, setBlogsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<SeoTab>('overview');
  const [overview, setOverview] = useState<SeoOverviewData | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedWorkshopSlug, setSelectedWorkshopSlug] = useState<string | null>(null);
  const [selectedBlogSlug, setSelectedBlogSlug] = useState<string | null>(null);
  const [draft, setDraft] = useState<SitePageSeoRow | null>(null);

  const loadPages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/super_admin/site-seo', { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || json?.details || 'Failed to load page SEO');
      const data = (json.data || []) as SitePageSeoRow[];
      setRows(data);
      setSelectedId((prev) => {
        if (prev && data.some((row) => row.id === prev)) return prev;
        return data[0]?.id || null;
      });
    } catch (err: any) {
      toast.error(err?.message || 'Could not load Advanced SEO pages');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadWorkshops = useCallback(async () => {
    setWorkshopsLoading(true);
    try {
      const res = await fetch('/api/super_admin/site-seo/workshops', { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || json?.details || 'Failed to load workshop SEO');
      const data = (json.data || []) as WorkshopSeoSummary[];
      setWorkshops(data);
      setSelectedWorkshopSlug((prev) => {
        if (prev && data.some((row) => row.slug === prev)) return prev;
        return data[0]?.slug || null;
      });
    } catch (err: any) {
      toast.error(err?.message || 'Could not load workshop SEO list');
    } finally {
      setWorkshopsLoading(false);
    }
  }, []);

  const loadBlogs = useCallback(async () => {
    setBlogsLoading(true);
    try {
      const res = await fetch('/api/super_admin/site-seo/blogs', { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || json?.details || 'Failed to load blog SEO');
      const data = (json.data || []) as BlogSeoSummary[];
      setBlogs(data);
      setSelectedBlogSlug((prev) => {
        if (prev && data.some((row) => row.slug === prev)) return prev;
        return data[0]?.slug || null;
      });
    } catch (err: any) {
      toast.error(err?.message || 'Could not load blog SEO list');
    } finally {
      setBlogsLoading(false);
    }
  }, []);

  const loadOverview = useCallback(async () => {
    setOverviewLoading(true);
    try {
      const res = await fetch('/api/super_admin/site-seo/overview', { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || json?.details || 'Failed to load SEO overview');
      setOverview(json.data as SeoOverviewData);
    } catch (err: any) {
      toast.error(err?.message || 'Could not load SEO overview');
    } finally {
      setOverviewLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    await Promise.all([loadPages(), loadWorkshops(), loadBlogs(), loadOverview()]);
  }, [loadPages, loadWorkshops, loadBlogs, loadOverview]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (tab === 'workshop' || tab === 'blog' || tab === 'technical' || tab === 'overview') return;
    const selected = rows.find((row) => row.id === selectedId) || null;
    setDraft(selected ? { ...selected } : null);
  }, [rows, selectedId, tab]);

  const servicePageCount = useMemo(
    () => rows.filter((row) => classifySitePagePath(row.page_path) === 'service').length,
    [rows],
  );

  const cityPageCount = useMemo(
    () => rows.filter((row) => classifySitePagePath(row.page_path) === 'city').length,
    [rows],
  );

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      const kind = classifySitePagePath(row.page_path);
      if (tab === 'static' && kind !== 'static') return false;
      if (tab === 'service' && kind !== 'service') return false;
      if (tab === 'city' && kind !== 'city') return false;
      if (tab === 'workshop' || tab === 'blog' || tab === 'technical' || tab === 'overview') return false;
      if (!q) return true;
      return (
        row.page_label.toLowerCase().includes(q) ||
        row.page_path.toLowerCase().includes(q) ||
        row.title.toLowerCase().includes(q)
      );
    });
  }, [query, rows, tab]);

  const filteredWorkshops = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return workshops;
    return workshops.filter(
      (row) =>
        row.page_label.toLowerCase().includes(q) ||
        row.slug.toLowerCase().includes(q) ||
        row.title.toLowerCase().includes(q),
    );
  }, [query, workshops]);

  const filteredBlogs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return blogs;
    return blogs.filter(
      (row) =>
        row.page_label.toLowerCase().includes(q) ||
        row.slug.toLowerCase().includes(q) ||
        row.title.toLowerCase().includes(q),
    );
  }, [query, blogs]);

  const selectedWorkshop = useMemo(
    () => workshops.find((row) => row.slug === selectedWorkshopSlug) || null,
    [workshops, selectedWorkshopSlug],
  );

  const selectedBlog = useMemo(
    () => blogs.find((row) => row.slug === selectedBlogSlug) || null,
    [blogs, selectedBlogSlug],
  );

  const seedServicePages = async () => {
    setSeeding(true);
    try {
      const res = await fetch('/api/super_admin/site-seo/seed-services', { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || json?.details || 'Seed failed');
      toast.success(json.inserted ? `Added ${json.inserted} service page(s)` : 'All service pages already exist');
      await loadPages();
      setTab('service');
    } catch (err: any) {
      toast.error(err?.message || 'Could not seed service pages');
    } finally {
      setSeeding(false);
    }
  };

  const seedCityPages = async () => {
    setSeeding(true);
    try {
      const res = await fetch('/api/super_admin/site-seo/seed-cities', { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || json?.details || 'Seed failed');
      toast.success(json.inserted ? `Added ${json.inserted} city page(s)` : 'All city pages already exist');
      await loadPages();
      setTab('city');
    } catch (err: any) {
      toast.error(err?.message || 'Could not seed city pages');
    } finally {
      setSeeding(false);
    }
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/super_admin/site-seo/${draft.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          page_label: draft.page_label,
          title: draft.title,
          description: draft.description,
          keywords: draft.keywords,
          keyphrase: draft.keyphrase,
          og_image: draft.og_image,
          canonical_path: draft.canonical_path,
          og_type: draft.og_type,
          city: draft.city,
          noindex: draft.noindex,
          active: draft.active,
          notes: draft.notes,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || json?.details || 'Save failed');
      const updated = json.data as SitePageSeoRow;
      setRows((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
      toast.success(`SEO saved for ${updated.page_label}`);
      await loadOverview();
    } catch (err: any) {
      toast.error(err?.message || 'Could not save page SEO');
    } finally {
      setSaving(false);
    }
  };

  const previewUrl = draft
    ? `${SITE_URL}${draft.canonical_path || draft.page_path}`
    : selectedWorkshop
      ? `${SITE_URL}/workshop/${selectedWorkshop.slug}`
      : selectedBlog
        ? `${SITE_URL}${selectedBlog.preview_href}`
        : SITE_URL;

  const listLoading = tab === 'workshop' ? workshopsLoading : tab === 'blog' ? blogsLoading : loading;

  return (
    <div className={t.page}>
      <div className={t.header}>
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <div>
            <div className={`flex items-center gap-2 text-sm ${t.subtitle}`}>
              <Globe className={`h-4 w-4 ${t.iconAccent}`} />
              App + Website
            </div>
            <h1 className={`mt-1 text-2xl font-black ${t.title}`}>Advanced SEO</h1>
            <p className={`mt-1 max-w-2xl text-sm ${t.subtitle}`}>
              Manage on-page SEO for static, service and city pages. Preview workshops and blogs. Configure technical SEO site-wide.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {tab !== 'workshop' && tab !== 'blog' && tab !== 'technical' && tab !== 'overview' && servicePageCount === 0 ? (
              <button
                type="button"
                onClick={seedServicePages}
                disabled={seeding || loading}
                className="inline-flex items-center gap-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-2 text-sm font-semibold text-indigo-300 hover:bg-indigo-500/20 disabled:opacity-60"
              >
                <Sparkles className={`h-4 w-4 ${seeding ? 'animate-spin' : ''}`} />
                {seeding ? 'Seeding…' : 'Seed Service Pages'}
              </button>
            ) : null}
            {tab !== 'workshop' && tab !== 'blog' && tab !== 'technical' && tab !== 'overview' && cityPageCount === 0 ? (
              <button
                type="button"
                onClick={seedCityPages}
                disabled={seeding || loading}
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-60"
              >
                <Sparkles className={`h-4 w-4 ${seeding ? 'animate-spin' : ''}`} />
                {seeding ? 'Seeding…' : 'Seed City Pages'}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => load()}
              disabled={loading || workshopsLoading || blogsLoading}
              className={t.btnGhost}
            >
              <RefreshCw className={`h-4 w-4 ${loading || workshopsLoading || blogsLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            {tab !== 'workshop' && tab !== 'blog' && tab !== 'technical' && tab !== 'overview' ? (
              <button
                type="button"
                onClick={save}
                disabled={saving || loading || !draft}
                className={t.btnPrimary}
              >
                <Save className="h-4 w-4" />
                {saving ? 'Saving…' : 'Save SEO'}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(TAB_META) as SeoTab[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={tab === key ? t.tabActive : t.tabInactive}
            >
              {TAB_META[key].label}
              {key === 'service'
                ? ` (${servicePageCount})`
                : key === 'city'
                  ? ` (${cityPageCount})`
                  : key === 'workshop'
                    ? ` (${workshops.length})`
                    : key === 'blog'
                      ? ` (${blogs.length})`
                      : ''}
            </button>
          ))}
        </div>
        <p className={`mt-2 text-sm ${t.subtitle}`}>{TAB_META[tab].subtitle}</p>
      </div>

      {tab === 'technical' ? (
        <div className="mx-auto max-w-7xl px-4 pb-6 sm:px-6">
          <TechnicalSeoPanel onRefreshAll={load} />
        </div>
      ) : tab === 'overview' ? (
        <div className="mx-auto max-w-7xl px-4 pb-6 sm:px-6">
          <SeoOverviewDashboard
            data={overview}
            loading={overviewLoading}
            onOpenTab={(nextTab) => setTab(nextTab as SeoTab)}
            onSelectPage={(id) => {
              setSelectedId(id);
              setTab('all');
            }}
          />
        </div>
      ) : (
      <div className="mx-auto grid max-w-7xl gap-6 px-4 pb-6 sm:px-6 lg:grid-cols-[320px_1fr]">
        <section className={`${t.card} p-4`}>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tab === 'workshop' ? 'Search workshops…' : tab === 'blog' ? 'Search blogs…' : 'Search pages…'}
              className={`${t.input} py-2.5 pl-10 pr-3`}
            />
          </div>
          <div className="mt-4 max-h-[70vh] space-y-1 overflow-y-auto">
            {listLoading ? (
              <p className={`px-2 py-6 text-sm ${t.subtitle}`}>Loading…</p>
            ) : tab === 'blog' ? (
              filteredBlogs.length === 0 ? (
                <p className={`px-2 py-6 text-sm ${t.subtitle}`}>No published blogs found.</p>
              ) : (
                filteredBlogs.map((row) => {
                  const active = row.slug === selectedBlogSlug;
                  return (
                    <button
                      key={row.id}
                      type="button"
                      onClick={() => setSelectedBlogSlug(row.slug)}
                      className={active ? t.listItemActive : t.listItem}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={t.listTitle}>{row.page_label}</span>
                        {!row.indexable ? <span className={t.badge.noindex}>Noindex</span> : null}
                      </div>
                      <p className={`mt-0.5 truncate text-xs ${t.subtitle}`}>{row.preview_href}</p>
                    </button>
                  );
                })
              )
            ) : tab === 'workshop' ? (
              filteredWorkshops.length === 0 ? (
                <p className={`px-2 py-6 text-sm ${t.subtitle}`}>No published workshops found.</p>
              ) : (
                filteredWorkshops.map((row) => {
                  const active = row.slug === selectedWorkshopSlug;
                  return (
                    <button
                      key={row.id}
                      type="button"
                      onClick={() => setSelectedWorkshopSlug(row.slug)}
                      className={active ? t.listItemActive : t.listItem}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={t.listTitle}>{row.page_label}</span>
                        <div className="flex items-center gap-1">
                          {row.noindex ? <span className={t.badge.noindex}>Noindex</span> : null}
                          <Store className="h-4 w-4 text-slate-500" />
                        </div>
                      </div>
                      <p className={`mt-0.5 truncate text-xs ${t.subtitle}`}>/workshop/{row.slug}</p>
                    </button>
                  );
                })
              )
            ) : filteredRows.length === 0 ? (
              <p className={`px-2 py-6 text-sm ${t.subtitle}`}>No pages found.</p>
            ) : (
              filteredRows.map((row) => {
                const active = row.id === selectedId;
                const kind = classifySitePagePath(row.page_path);
                return (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => setSelectedId(row.id)}
                    className={active ? t.listItemActive : t.listItem}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={t.listTitle}>{row.page_label}</span>
                      <div className="flex items-center gap-1">
                        {kind === 'service' ? <span className={t.badge.service}>Service</span> : null}
                        {kind === 'city' ? <span className={t.badge.city}>City</span> : null}
                        {!row.active ? (
                          <span className={t.badge.off}>Off</span>
                        ) : row.noindex ? (
                          <span className={t.badge.noindex}>Noindex</span>
                        ) : null}
                      </div>
                    </div>
                    <p className={`mt-0.5 truncate text-xs ${t.subtitle}`}>{row.page_path}</p>
                  </button>
                );
              })
            )}
          </div>
        </section>

        <section className="space-y-4">
          {tab === 'workshop' ? (
            !selectedWorkshop ? (
              <div className={`${t.cardMuted} p-10 text-center text-sm ${t.subtitle}`}>
                Select a workshop to preview SEO.
              </div>
            ) : (
              <>
                <div className={`${t.card} p-5`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className={`text-lg font-black ${t.title}`}>{selectedWorkshop.page_label}</h2>
                      <p className={`mt-1 text-sm ${t.subtitle}`}>/workshop/{selectedWorkshop.slug}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <a href={previewUrl} target="_blank" rel="noreferrer" className={t.btnGhost}>
                        <ExternalLink className="h-4 w-4" />
                        Preview page
                      </a>
                      <a href={selectedWorkshop.edit_href} className={t.btnDark}>
                        Edit in Workshop Pages
                      </a>
                    </div>
                  </div>
                </div>

                <div className={t.alert}>
                  Workshop SEO is edited in <strong>Workshop Public Pages</strong> (meta title, description, keywords). Changes appear on the live page within ~5 minutes.
                </div>

                <div className={`${t.card} p-5`}>
                  <h3 className={t.sectionTitle}>Search Preview</h3>
                  <div className="mt-4 space-y-1">
                    <p className={t.searchTitle}>{selectedWorkshop.title || 'Workshop title'}</p>
                    <p className={t.searchUrl}>{previewUrl}</p>
                    <p className={`text-sm leading-6 ${t.body}`}>
                      {selectedWorkshop.description || 'Meta description not set yet.'}
                    </p>
                  </div>
                </div>

                <div className={`${t.card} p-5`}>
                  <div className="grid gap-4 text-sm">
                    <div>
                      <p className={t.label}>Meta title</p>
                      <p className={`mt-1 ${t.body}`}>{selectedWorkshop.title || '—'}</p>
                    </div>
                    <div>
                      <p className={t.label}>Meta description</p>
                      <p className={`mt-1 ${t.body}`}>{selectedWorkshop.description || '—'}</p>
                    </div>
                    <div>
                      <p className={t.label}>Indexable</p>
                      <p className={`mt-1 ${t.body}`}>{selectedWorkshop.noindex ? 'No (noindex)' : 'Yes'}</p>
                    </div>
                    <div>
                      <p className={t.label}>Keywords</p>
                      <p className={`mt-1 ${t.body}`}>{selectedWorkshop.keywords || '—'}</p>
                    </div>
                  </div>
                </div>
              </>
            )
          ) : tab === 'blog' ? (
            !selectedBlog ? (
              <div className={`${t.cardMuted} p-10 text-center text-sm ${t.subtitle}`}>
                Select a blog to preview SEO.
              </div>
            ) : (
              <>
                <div className={`${t.card} p-5`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className={`text-lg font-black ${t.title}`}>{selectedBlog.page_label}</h2>
                      <p className={`mt-1 text-sm ${t.subtitle}`}>{selectedBlog.preview_href}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <a href={previewUrl} target="_blank" rel="noreferrer" className={t.btnGhost}>
                        <ExternalLink className="h-4 w-4" />
                        Preview blog
                      </a>
                      <a href={selectedBlog.edit_href} className={t.btnDark}>
                        Edit in Digital Marketing
                      </a>
                    </div>
                  </div>
                </div>

                <div className={t.alert}>
                  Blog SEO is edited in <strong>Digital Marketing → Blogs</strong>. Posts with Index unchecked are excluded from sitemap.xml.
                </div>

                <div className={`${t.card} p-5`}>
                  <h3 className={t.sectionTitle}>Search Preview</h3>
                  <div className="mt-4 space-y-1">
                    <p className={t.searchTitle}>{selectedBlog.title || 'Blog title'}</p>
                    <p className={t.searchUrl}>{previewUrl}</p>
                    <p className={`text-sm leading-6 ${t.body}`}>{selectedBlog.description || 'Meta description not set yet.'}</p>
                  </div>
                </div>

                <div className={`${t.card} p-5`}>
                  <div className="grid gap-4 text-sm">
                    <div>
                      <p className={t.label}>Indexable</p>
                      <p className={`mt-1 ${t.body}`}>{selectedBlog.indexable ? 'Yes' : 'No (noindex)'}</p>
                    </div>
                    <div>
                      <p className={t.label}>Keywords</p>
                      <p className={`mt-1 ${t.body}`}>{selectedBlog.keywords || '—'}</p>
                    </div>
                  </div>
                </div>
              </>
            )
          ) : !draft ? (
            <div className={`${t.cardMuted} p-10 text-center text-sm ${t.subtitle}`}>
              Select a page to edit SEO.
            </div>
          ) : (
            <>
              <div className={`${t.card} p-5`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className={`text-lg font-black ${t.title}`}>{draft.page_label}</h2>
                    <p className={`mt-1 text-sm ${t.subtitle}`}>{draft.page_path}</p>
                  </div>
                  <a href={previewUrl} target="_blank" rel="noreferrer" className={t.btnGhost}>
                    <ExternalLink className="h-4 w-4" />
                    Preview page
                  </a>
                </div>
              </div>

              <div className={`${t.card} p-5`}>
                <h3 className={t.sectionTitle}>Search Preview</h3>
                <div className="mt-4 space-y-1">
                  <p className={t.searchTitle}>{draft.title || 'Page title'}</p>
                  <p className={t.searchUrl}>{previewUrl}</p>
                  <p className={`text-sm leading-6 ${t.body}`}>{draft.description || 'Meta description will appear here.'}</p>
                </div>
              </div>

              <div className={`${t.card} p-5`}>
                <div className="grid gap-5">
                  <Field label="Admin label">
                    <input
                      value={draft.page_label}
                      onChange={(e) => setDraft((prev) => (prev ? { ...prev, page_label: e.target.value } : prev))}
                      className={t.input}
                    />
                  </Field>

                  <Field label="Meta title" hint={<CharCount value={draft.title} ideal={60} />}>
                    <input
                      value={draft.title}
                      onChange={(e) => setDraft((prev) => (prev ? { ...prev, title: e.target.value } : prev))}
                      className={t.input}
                    />
                  </Field>

                  <Field label="Meta description" hint={<CharCount value={draft.description} ideal={160} />}>
                    <textarea
                      value={draft.description}
                      onChange={(e) => setDraft((prev) => (prev ? { ...prev, description: e.target.value } : prev))}
                      rows={4}
                      className={t.textarea}
                    />
                  </Field>

                  <Field label="Keywords" hint="Comma-separated">
                    <textarea
                      value={draft.keywords}
                      onChange={(e) => setDraft((prev) => (prev ? { ...prev, keywords: e.target.value } : prev))}
                      rows={3}
                      className={t.textarea}
                    />
                  </Field>

                  <div className="grid gap-5 md:grid-cols-2">
                    <Field label="Focus keyphrase">
                      <input
                        value={draft.keyphrase}
                        onChange={(e) => setDraft((prev) => (prev ? { ...prev, keyphrase: e.target.value } : prev))}
                        className={t.input}
                      />
                    </Field>
                    <Field label="City (copyright meta)">
                      <input
                        value={draft.city}
                        onChange={(e) => setDraft((prev) => (prev ? { ...prev, city: e.target.value } : prev))}
                        className={t.input}
                      />
                    </Field>
                  </div>

                  <div className="grid gap-5 md:grid-cols-2">
                    <Field label="Canonical path">
                      <input
                        value={draft.canonical_path}
                        onChange={(e) => setDraft((prev) => (prev ? { ...prev, canonical_path: e.target.value } : prev))}
                        className={t.input}
                      />
                    </Field>
                    <Field label="OG image URL">
                      <input
                        value={draft.og_image}
                        onChange={(e) => setDraft((prev) => (prev ? { ...prev, og_image: e.target.value } : prev))}
                        placeholder="Leave blank for default"
                        className={t.input}
                      />
                    </Field>
                  </div>

                  <div className="grid gap-5 md:grid-cols-3">
                    <Field label="OG type">
                      <select
                        value={draft.og_type}
                        onChange={(e) =>
                          setDraft((prev) =>
                            prev ? { ...prev, og_type: e.target.value === 'article' ? 'article' : 'website' } : prev,
                          )
                        }
                        className={t.select}
                      >
                        <option value="website">website</option>
                        <option value="article">article</option>
                      </select>
                    </Field>
                    <label className={t.checkbox}>
                      <input
                        type="checkbox"
                        checked={draft.noindex}
                        onChange={(e) => setDraft((prev) => (prev ? { ...prev, noindex: e.target.checked } : prev))}
                      />
                      Noindex
                    </label>
                    <label className={t.checkbox}>
                      <input
                        type="checkbox"
                        checked={draft.active}
                        onChange={(e) => setDraft((prev) => (prev ? { ...prev, active: e.target.checked } : prev))}
                      />
                      Active
                    </label>
                  </div>

                  <Field label="Internal notes">
                    <textarea
                      value={draft.notes}
                      onChange={(e) => setDraft((prev) => (prev ? { ...prev, notes: e.target.value } : prev))}
                      rows={2}
                      placeholder="Optional notes for your team"
                      className={t.textarea}
                    />
                  </Field>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
      )}
    </div>
  );
}
