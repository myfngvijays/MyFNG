'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Copy, ExternalLink, Globe, Plus, RefreshCw, Save, Search, Sparkles, Store, Trash2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { SITE_URL } from '@/lib/seo/metadata';
import { classifySitePagePath } from '@/lib/site-page-seo';
import type { SitePageSeoRow } from '@/lib/site-page-seo';
import { buildBlogSchemaPreview, sanitizeBlogSlug, type BlogSeoSummary } from '@/lib/blog/seo';
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
  blog: { label: 'Blogs', subtitle: 'Full on-page SEO for published blog posts' },
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
  const [blogDraft, setBlogDraft] = useState<BlogSeoSummary | null>(null);
  const [jsonLdCopied, setJsonLdCopied] = useState(false);

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

  useEffect(() => {
    if (tab !== 'blog') return;
    const selected = blogs.find((row) => row.slug === selectedBlogSlug) || null;
    setBlogDraft(selected ? { ...selected, faqs: selected.faqs || [] } : null);
  }, [blogs, selectedBlogSlug, tab]);

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

  const syncSeoPaths = async (scope: 'all' | 'service' | 'city' = 'all') => {
    setSeeding(true);
    try {
      const res = await fetch('/api/super_admin/site-seo/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || json?.details || 'Sync failed');
      const remapped = Number(json.remapped || 0);
      const inserted = Number(json.inserted || 0);
      toast.success(
        remapped || inserted
          ? `Updated ${remapped} URL(s), added ${inserted} missing page(s)`
          : 'All SEO URLs already match the live site',
      );
      await loadPages();
      await loadOverview();
      if (scope === 'service') setTab('service');
      if (scope === 'city') setTab('city');
    } catch (err: any) {
      toast.error(err?.message || 'Could not sync page SEO URLs');
    } finally {
      setSeeding(false);
    }
  };

  const saveBlog = async () => {
    if (!blogDraft) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/super_admin/site-seo/blogs/${blogDraft.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: sanitizeBlogSlug(blogDraft.slug),
          title: blogDraft.title,
          description: blogDraft.description,
          keywords: blogDraft.keywords,
          keyphrase: blogDraft.keyphrase,
          canonical_url: blogDraft.canonical_url,
          og_title: blogDraft.og_title,
          og_description: blogDraft.og_description,
          og_image: blogDraft.og_image,
          featured_image_alt: blogDraft.featured_image_alt,
          search_intent: blogDraft.search_intent,
          local_city: blogDraft.local_city,
          local_areas: blogDraft.local_areas,
          author_name: blogDraft.author_name,
          author_role: blogDraft.author_role,
          robots_index: blogDraft.robots_index,
          robots_follow: blogDraft.robots_follow,
          schema_blogposting: blogDraft.schema_blogposting,
          schema_faq: blogDraft.schema_faq,
          eligible_ai_overview: blogDraft.eligible_ai_overview,
          faqs: blogDraft.faqs,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || json?.details || 'Save failed');
      const updated = json.data as BlogSeoSummary;
      setBlogs((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
      setSelectedBlogSlug(updated.slug);
      setBlogDraft(updated);
      toast.success(`Blog SEO saved for ${updated.page_label}`);
      await loadOverview();
    } catch (err: any) {
      toast.error(err?.message || 'Could not save blog SEO');
    } finally {
      setSaving(false);
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
      : blogDraft
        ? `${SITE_URL}/blogs/${sanitizeBlogSlug(blogDraft.slug) || blogDraft.slug}`
        : selectedBlog
          ? `${SITE_URL}${selectedBlog.preview_href}`
          : SITE_URL;

  const blogSchemaPreview = useMemo(
    () =>
      blogDraft
        ? buildBlogSchemaPreview({
            slug: blogDraft.slug,
            title: blogDraft.title || blogDraft.post_title,
            description: blogDraft.description,
            keywords: blogDraft.keywords,
            author_name: blogDraft.author_name,
            schema_blogposting: blogDraft.schema_blogposting,
            schema_faq: blogDraft.schema_faq,
            eligible_ai_overview: blogDraft.eligible_ai_overview,
            faqs: blogDraft.faqs,
          })
        : null,
    [blogDraft],
  );

  const listLoading = tab === 'workshop' ? workshopsLoading : tab === 'blog' ? blogsLoading : loading;

  return (
    <div className={t.page}>
      <div className={t.header}>
        <div className="mx-auto flex w-full max-w-[1600px] flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <div>
            <div className={`flex items-center gap-2 text-sm ${t.subtitle}`}>
              <Globe className={`h-4 w-4 ${t.iconAccent}`} />
              App + Website
            </div>
            <h1 className={`mt-1 text-2xl font-black ${t.title}`}>Advanced SEO</h1>
            <p className={`mt-1 max-w-2xl text-sm ${t.subtitle}`}>
              Manage on-page SEO for static, service, city and blog pages. Preview workshops. Configure technical SEO site-wide.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => syncSeoPaths('all')}
              disabled={seeding || loading}
              className={t.btnGhost}
            >
              <Sparkles className={`h-4 w-4 ${seeding ? 'animate-spin' : ''}`} />
              {seeding ? 'Syncing…' : 'Sync URLs'}
            </button>
            <button
              type="button"
              onClick={() => load()}
              disabled={loading || workshopsLoading || blogsLoading}
              className={t.btnGhost}
            >
              <RefreshCw className={`h-4 w-4 ${loading || workshopsLoading || blogsLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            {tab === 'blog' ? (
              <button
                type="button"
                onClick={saveBlog}
                disabled={saving || blogsLoading || !blogDraft}
                className={t.btnPrimary}
              >
                <Save className="h-4 w-4" />
                {saving ? 'Saving…' : 'Save blog SEO'}
              </button>
            ) : tab !== 'workshop' && tab !== 'technical' && tab !== 'overview' ? (
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

      <div className="mx-auto w-full max-w-[1600px] px-4 py-4 sm:px-6">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(TAB_META) as SeoTab[]).map((key) => {
            const active = tab === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={
                  active
                    ? 'rounded-full px-4 py-2 text-sm font-semibold text-white shadow-md shadow-blue-900/15'
                    : t.tabInactive
                }
                style={
                  active
                    ? {
                        backgroundImage: 'linear-gradient(to right, #023D95, #0088E8)',
                        backgroundColor: '#023D95',
                        color: '#ffffff',
                      }
                    : undefined
                }
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
            );
          })}
        </div>
        <p className={`mt-2 text-sm ${t.subtitle}`}>{TAB_META[tab].subtitle}</p>
      </div>

      {tab === 'technical' ? (
        <div className="mx-auto w-full max-w-[1600px] px-4 pb-6 sm:px-6">
          <TechnicalSeoPanel onRefreshAll={load} />
        </div>
      ) : tab === 'overview' ? (
        <div className="mx-auto w-full max-w-[1600px] px-4 pb-6 sm:px-6">
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
      <div className="mx-auto grid w-full max-w-[1600px] items-start gap-6 px-4 pb-6 sm:px-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <section className={`${t.card} p-4 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-7rem)] lg:overflow-hidden`}>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tab === 'workshop' ? 'Search workshops…' : tab === 'blog' ? 'Search blogs…' : 'Search pages…'}
              className={`${t.input} py-2.5 pl-10 pr-3`}
            />
          </div>
          <div className="mt-4 max-h-[60vh] space-y-1 overflow-y-auto lg:max-h-[calc(100dvh-12rem)]">
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

        <section className="min-w-0 space-y-4">
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
            !blogDraft ? (
              <div className={`${t.cardMuted} p-10 text-center text-sm ${t.subtitle}`}>
                Select a blog to edit SEO.
              </div>
            ) : (
              <>
                <div className={`${t.card} p-5`}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h2 className={`text-lg font-black ${t.title}`}>{blogDraft.post_title || blogDraft.page_label}</h2>
                      <p className={`mt-1 break-all text-sm ${t.subtitle}`}>
                        {`/blogs/${sanitizeBlogSlug(blogDraft.slug) || blogDraft.slug}`}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <a href={`${SITE_URL}/blogs/${sanitizeBlogSlug(blogDraft.slug) || blogDraft.slug}`} target="_blank" rel="noreferrer" className={t.btnGhost}>
                        <ExternalLink className="h-4 w-4" />
                        Preview blog
                      </a>
                      <a href={blogDraft.edit_href} className={t.btnDark}>
                        Open full editor
                      </a>
                    </div>
                  </div>
                </div>

                <div className={`${t.card} p-5`}>
                  <h3 className={t.sectionTitle}>Search Preview</h3>
                  <div className="mt-4 space-y-1">
                    <p className={t.searchTitle}>{blogDraft.title || 'Blog title'}</p>
                    <p className={t.searchUrl}>{`${SITE_URL}/blogs/${sanitizeBlogSlug(blogDraft.slug) || blogDraft.slug}`}</p>
                    <p className={`text-sm leading-6 ${t.body}`}>{blogDraft.description || 'Meta description will appear here.'}</p>
                  </div>
                </div>

                <div className={`${t.card} p-5`}>
                  <div className="grid gap-5">
                    <Field
                      label="URL slug"
                      hint={
                        <button
                          type="button"
                          className="text-xs font-semibold text-brand-fng hover:underline"
                          onClick={() => {
                            const next = sanitizeBlogSlug(blogDraft.post_title || blogDraft.title);
                            if (!next) return;
                            setBlogDraft((prev) => (prev ? { ...prev, slug: next, preview_href: `/blogs/${next}` } : prev));
                          }}
                        >
                          Suggest from title
                        </button>
                      }
                    >
                      <input
                        value={blogDraft.slug}
                        onChange={(e) => {
                          const raw = e.target.value;
                          setBlogDraft((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  slug: raw,
                                  preview_href: `/blogs/${sanitizeBlogSlug(raw) || raw}`,
                                }
                              : prev,
                          );
                        }}
                        onBlur={() => {
                          const next = sanitizeBlogSlug(blogDraft.slug);
                          if (!next) return;
                          setBlogDraft((prev) => (prev ? { ...prev, slug: next, preview_href: `/blogs/${next}` } : prev));
                        }}
                        placeholder="before-you-blame-the-workshop"
                        className={t.input}
                      />
                      <p className={`mt-1.5 text-xs ${t.subtitle}`}>
                        Public URL: {SITE_URL}/blogs/{sanitizeBlogSlug(blogDraft.slug) || 'your-slug'}
                      </p>
                    </Field>
                    <Field label="Meta title" hint={<CharCount value={blogDraft.title} ideal={60} />}>
                      <input
                        value={blogDraft.title}
                        onChange={(e) => setBlogDraft((prev) => (prev ? { ...prev, title: e.target.value } : prev))}
                        className={t.input}
                      />
                    </Field>
                    <Field label="Meta description" hint={<CharCount value={blogDraft.description} ideal={155} />}>
                      <textarea
                        value={blogDraft.description}
                        onChange={(e) => setBlogDraft((prev) => (prev ? { ...prev, description: e.target.value } : prev))}
                        rows={4}
                        className={t.textarea}
                      />
                    </Field>
                    <Field label="Keywords" hint="Comma-separated">
                      <textarea
                        value={blogDraft.keywords}
                        onChange={(e) => setBlogDraft((prev) => (prev ? { ...prev, keywords: e.target.value } : prev))}
                        rows={3}
                        className={t.textarea}
                      />
                    </Field>
                    <div className="grid gap-5 md:grid-cols-2">
                      <Field label="Focus keyphrase">
                        <input
                          value={blogDraft.keyphrase}
                          onChange={(e) => setBlogDraft((prev) => (prev ? { ...prev, keyphrase: e.target.value } : prev))}
                          className={t.input}
                        />
                      </Field>
                      <Field label="Search intent">
                        <select
                          value={blogDraft.search_intent}
                          onChange={(e) => setBlogDraft((prev) => (prev ? { ...prev, search_intent: e.target.value } : prev))}
                          className={t.select}
                        >
                          <option value="Informational">Informational</option>
                          <option value="Commercial">Commercial</option>
                          <option value="Transactional">Transactional</option>
                          <option value="Navigational">Navigational</option>
                        </select>
                      </Field>
                    </div>
                    <div className="grid gap-5 md:grid-cols-2">
                      <Field label="Canonical URL">
                        <input
                          value={blogDraft.canonical_url}
                          onChange={(e) => setBlogDraft((prev) => (prev ? { ...prev, canonical_url: e.target.value } : prev))}
                          placeholder="https://myfng.in/blogs/your-slug"
                          className={t.input}
                        />
                      </Field>
                      <Field label="OG image URL">
                        <input
                          value={blogDraft.og_image}
                          onChange={(e) => setBlogDraft((prev) => (prev ? { ...prev, og_image: e.target.value } : prev))}
                          className={t.input}
                        />
                      </Field>
                    </div>
                    <div className="grid gap-5 md:grid-cols-2">
                      <Field label="OG title" hint={<CharCount value={blogDraft.og_title} ideal={60} />}>
                        <input
                          value={blogDraft.og_title}
                          onChange={(e) => setBlogDraft((prev) => (prev ? { ...prev, og_title: e.target.value } : prev))}
                          className={t.input}
                        />
                      </Field>
                      <Field label="Featured image ALT" hint={<CharCount value={blogDraft.featured_image_alt} ideal={125} />}>
                        <input
                          value={blogDraft.featured_image_alt}
                          onChange={(e) => setBlogDraft((prev) => (prev ? { ...prev, featured_image_alt: e.target.value } : prev))}
                          className={t.input}
                        />
                      </Field>
                    </div>
                    <Field label="OG description" hint={<CharCount value={blogDraft.og_description} ideal={155} />}>
                      <textarea
                        value={blogDraft.og_description}
                        onChange={(e) => setBlogDraft((prev) => (prev ? { ...prev, og_description: e.target.value } : prev))}
                        rows={3}
                        className={t.textarea}
                      />
                    </Field>
                    <div className="grid gap-5 md:grid-cols-2">
                      <Field label="Target city">
                        <input
                          value={blogDraft.local_city}
                          onChange={(e) => setBlogDraft((prev) => (prev ? { ...prev, local_city: e.target.value } : prev))}
                          placeholder="e.g. Thane"
                          className={t.input}
                        />
                      </Field>
                      <Field label="Local areas" hint="Comma-separated">
                        <input
                          value={blogDraft.local_areas}
                          onChange={(e) => setBlogDraft((prev) => (prev ? { ...prev, local_areas: e.target.value } : prev))}
                          placeholder="Wagle Estate, Manpada"
                          className={t.input}
                        />
                      </Field>
                    </div>
                    <div className="grid gap-5 md:grid-cols-2">
                      <Field label="Author name">
                        <input
                          value={blogDraft.author_name}
                          onChange={(e) => setBlogDraft((prev) => (prev ? { ...prev, author_name: e.target.value } : prev))}
                          className={t.input}
                        />
                      </Field>
                      <Field label="Author role">
                        <input
                          value={blogDraft.author_role}
                          onChange={(e) => setBlogDraft((prev) => (prev ? { ...prev, author_role: e.target.value } : prev))}
                          className={t.input}
                        />
                      </Field>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      {[
                        { key: 'robots_index', label: 'Allow search indexing' },
                        { key: 'robots_follow', label: 'Allow follow links' },
                        { key: 'schema_blogposting', label: 'BlogPosting schema' },
                        { key: 'schema_faq', label: 'FAQ schema' },
                        { key: 'eligible_ai_overview', label: 'AI Overview (SGE)' },
                      ].map((item) => (
                        <label key={item.key} className={t.checkbox}>
                          <input
                            type="checkbox"
                            checked={Boolean(blogDraft[item.key as keyof BlogSeoSummary])}
                            onChange={(e) =>
                              setBlogDraft((prev) => (prev ? { ...prev, [item.key]: e.target.checked } : prev))
                            }
                          />
                          {item.label}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className={`${t.card} p-5`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className={t.sectionTitle}>Schema builder</h3>
                      <p className={`mt-2 text-sm ${t.subtitle}`}>
                        Add FAQ Q&As to generate FAQPage JSON-LD. BlogPosting and AI Overview blocks follow the toggles above.
                      </p>
                    </div>
                    <button
                      type="button"
                      className={t.btnGhost}
                      onClick={() =>
                        setBlogDraft((prev) =>
                          prev
                            ? {
                                ...prev,
                                schema_faq: true,
                                faqs: [...(prev.faqs || []), { question: '', answer: '' }],
                              }
                            : prev,
                        )
                      }
                    >
                      <Plus className="h-4 w-4" />
                      Add FAQ
                    </button>
                  </div>

                  <div className="mt-4 grid gap-5 xl:grid-cols-2">
                    <div className="space-y-3">
                    {(blogDraft.faqs || []).length === 0 ? (
                      <div className={`${t.cardMuted} p-4 text-sm ${t.subtitle}`}>
                        No FAQs yet. Add questions to build FAQ schema for this blog.
                      </div>
                    ) : (
                      (blogDraft.faqs || []).map((faq, idx) => (
                        <div key={`faq-${idx}`} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <span className="text-xs font-bold uppercase tracking-wide text-slate-400">FAQ {idx + 1}</span>
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:underline"
                              onClick={() =>
                                setBlogDraft((prev) =>
                                  prev ? { ...prev, faqs: (prev.faqs || []).filter((_, i) => i !== idx) } : prev,
                                )
                              }
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Remove
                            </button>
                          </div>
                          <input
                            value={faq.question}
                            onChange={(e) =>
                              setBlogDraft((prev) => {
                                if (!prev) return prev;
                                const faqs = [...(prev.faqs || [])];
                                faqs[idx] = { ...faqs[idx], question: e.target.value };
                                return { ...prev, faqs, schema_faq: true };
                              })
                            }
                            placeholder="Question"
                            className={`${t.input} mb-2`}
                          />
                          <textarea
                            value={faq.answer}
                            onChange={(e) =>
                              setBlogDraft((prev) => {
                                if (!prev) return prev;
                                const faqs = [...(prev.faqs || [])];
                                faqs[idx] = { ...faqs[idx], answer: e.target.value };
                                return { ...prev, faqs, schema_faq: true };
                              })
                            }
                            rows={3}
                            placeholder="Answer"
                            className={t.textarea}
                          />
                        </div>
                      ))
                    )}
                    </div>

                    <div className="min-w-0">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                        <h4 className={t.sectionTitle}>JSON-LD preview</h4>
                        <div className="flex items-center gap-2">
                          <span className={t.hint}>
                            {(blogDraft.faqs || []).filter((f) => f.question.trim() && f.answer.trim()).length} FAQ
                            {(blogDraft.faqs || []).filter((f) => f.question.trim() && f.answer.trim()).length === 1 ? '' : 's'} in schema
                          </span>
                          <button
                            type="button"
                            className={t.btnGhost}
                            onClick={async () => {
                              const text = JSON.stringify(blogSchemaPreview, null, 2);
                              try {
                                await navigator.clipboard.writeText(text);
                                setJsonLdCopied(true);
                                toast.success('JSON-LD copied');
                                window.setTimeout(() => setJsonLdCopied(false), 1600);
                              } catch {
                                toast.error('Could not copy JSON-LD');
                              }
                            }}
                          >
                            {jsonLdCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                            {jsonLdCopied ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                      </div>
                      <pre className={`${t.codeEditor} max-h-[36rem] overflow-auto`}>
                        {JSON.stringify(blogSchemaPreview, null, 2)}
                      </pre>
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
