'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import DashboardLayout from '@/components/DashboardLayout';
import { formatDateDMY } from '@/lib/utils';
import {
  CalendarClock,
  CheckCircle2,
  Eye,
  Plus,
  Sparkles,
  Target,
  TrendingUp,
  UserCheck,
} from 'lucide-react';
import DailyBlogScheduleCard from '@/components/blog/DailyBlogScheduleCard';

type BlogCard = {
  id: string;
  title: string;
  slug: string;
  status: string;
  views: number;
  likes: number;
  is_featured: boolean;
  read_time: number;
  published_at: string | null;
  updated_at: string | null;
  created_at: string | null;
  author_name: string;
};

type DailyRun = { run_date: string; status: string; topic: string | null; error: string | null };

type DashboardData = {
  summary: {
    total: number;
    published: number;
    draft: number;
    pendingReview: number;
    archived: number;
    featured: number;
    premium: number;
    totalViews: number;
    totalLikes: number;
    avgViews: number;
    avgReadTime: number;
    publishedThisMonth: number;
    createdThisMonth: number;
    publishedToday: number;
    publishedThisWeek: number;
    dailyAi: number;
    batchAi: number;
    rsaPosts: number;
    uspPosts: number;
    packagePosts: number;
    unassignedAuthor: number;
  };
  inventory: { categories: number; tags: number; comments: number; pendingComments: number; faqs: number };
  seoHealth: {
    missingMetaDescription: number;
    missingFeaturedImage: number;
    missingFeaturedAlt: number;
    missingExcerpt: number;
    missingFaqsOnPublished: number;
    missingLocalCity: number;
    score: number;
  };
  dailyPost: {
    missing_table?: boolean;
    enabled: boolean;
    last_status: string | null;
    last_error: string | null;
    last_run_at: string | null;
    last_blog: { id: string; title: string; slug: string; published_at: string | null } | null;
    today: string;
    today_posted: boolean;
    today_posted_count?: number;
    posts_per_day?: number;
    post_times?: string[];
    next_run_at: string;
    schedule: string;
    cron: string;
    provider: string;
    city_rotation: string;
    usp_rotation: string;
    recent_runs: DailyRun[];
  };
  statusBreakdown: Array<{ status: string; label: string; count: number; color: string }>;
  categoryBreakdown: Array<{ id: string; name: string; slug: string; count: number }>;
  topByViews: BlogCard[];
  pendingReview: BlogCard[];
  recentPublished: BlogCard[];
  recentlyUpdated: BlogCard[];
  recentPackage: BlogCard[];
};

const EMPTY: DashboardData = {
  summary: {
    total: 0,
    published: 0,
    draft: 0,
    pendingReview: 0,
    archived: 0,
    featured: 0,
    premium: 0,
    totalViews: 0,
    totalLikes: 0,
    avgViews: 0,
    avgReadTime: 0,
    publishedThisMonth: 0,
    createdThisMonth: 0,
    publishedToday: 0,
    publishedThisWeek: 0,
    dailyAi: 0,
    batchAi: 0,
    rsaPosts: 0,
    uspPosts: 0,
    packagePosts: 0,
    unassignedAuthor: 0,
  },
  inventory: { categories: 0, tags: 0, comments: 0, pendingComments: 0, faqs: 0 },
  seoHealth: {
    missingMetaDescription: 0,
    missingFeaturedImage: 0,
    missingFeaturedAlt: 0,
    missingExcerpt: 0,
    missingFaqsOnPublished: 0,
    missingLocalCity: 0,
    score: 100,
  },
  dailyPost: {
    enabled: true,
    last_status: null,
    last_error: null,
    last_run_at: null,
    last_blog: null,
    today: '',
    today_posted: false,
    today_posted_count: 0,
    posts_per_day: 1,
    post_times: ['10:00'],
    next_run_at: '',
    schedule: '10:00 IST',
    cron: '30 * * * *',
    provider: 'Supabase Cronon',
    city_rotation: '',
    usp_rotation: '',
    recent_runs: [],
  },
  statusBreakdown: [],
  categoryBreakdown: [],
  topByViews: [],
  pendingReview: [],
  recentPublished: [],
  recentlyUpdated: [],
  recentPackage: [],
};

function fmtDate(v?: string | null) {
  if (!v) return '—';
  return formatDateDMY(new Date(v));
}

function fmtDateTime(v?: string | null) {
  if (!v) return '—';
  const d = new Date(v);
  return `${formatDateDMY(d)} · ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })} IST`;
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    published: 'bg-emerald-100 text-emerald-800',
    draft: 'bg-slate-100 text-slate-700',
    pending_review: 'bg-amber-100 text-amber-800',
    archived: 'bg-gray-100 text-gray-600',
    success: 'bg-emerald-100 text-emerald-800',
    failed: 'bg-rose-100 text-rose-800',
    skipped: 'bg-slate-100 text-slate-600',
  };
  const label =
    status === 'pending_review' ? 'Pending Review' : status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold ${map[status] || map.draft}`}>
      {label}
    </span>
  );
}

function StatChip({
  title,
  value,
  href,
}: {
  title: string;
  value: string | number;
  href?: string;
}) {
  const inner = (
    <div className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 hover:border-[#023D95]/30 h-full min-w-0">
      <p className="text-[10px] leading-tight text-slate-500 truncate">{title}</p>
      <p className="text-sm font-bold text-[#023D95] tabular-nums leading-tight mt-0.5">{value}</p>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function BlogRow({ blog, showAuthor = false }: { blog: BlogCard; showAuthor?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1.5 border-b border-slate-100 last:border-0">
      <div className="min-w-0 flex-1">
        <Link href={`/dashboard/digital_marketing/blogs/${blog.id}/edit`} className="font-medium text-[13px] text-[#023D95] hover:underline line-clamp-1">
          {blog.title}
        </Link>
        <p className="text-[10px] text-slate-500 truncate">
          {showAuthor ? `${blog.author_name} · ` : ''}
          {blog.views.toLocaleString()} views · {fmtDate(blog.published_at || blog.updated_at)}
        </p>
      </div>
      {statusBadge(blog.status)}
    </div>
  );
}

export default function DigitalMarketingDashboard() {
  const [data, setData] = useState<DashboardData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [syncingAuthors, setSyncingAuthors] = useState(false);

  useEffect(() => {
    void loadDashboard();
  }, []);

  async function loadDashboard() {
    setLoading(true);
    try {
      const res = await fetch('/api/blogs/dashboard-stats', { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to load dashboard');
      setData({
        ...EMPTY,
        ...json,
        summary: { ...EMPTY.summary, ...(json.summary || {}) },
        dailyPost: { ...EMPTY.dailyPost, ...(json.dailyPost || {}) },
        recentPackage: Array.isArray(json.recentPackage) ? json.recentPackage : [],
        recentPublished: Array.isArray(json.recentPublished) ? json.recentPublished : [],
        recentlyUpdated: Array.isArray(json.recentlyUpdated) ? json.recentlyUpdated : [],
      });
      setError('');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }

  async function syncBlogsToAuthor() {
    setSyncingAuthors(true);
    try {
      const res = await fetch('/api/blogs/assign-authors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to sync authors');
      toast.success(json?.message || `Updated ${json?.updated || 0} blog(s)`);
      await loadDashboard();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to sync authors');
    } finally {
      setSyncingAuthors(false);
    }
  }

  const seoIssues = useMemo(
    () =>
      [
        { label: 'Missing meta description', count: data.seoHealth.missingMetaDescription },
        { label: 'Missing featured image', count: data.seoHealth.missingFeaturedImage },
        { label: 'Missing image ALT text', count: data.seoHealth.missingFeaturedAlt },
        { label: 'Missing excerpt/summary', count: data.seoHealth.missingExcerpt },
        { label: 'Published without FAQs', count: data.seoHealth.missingFaqsOnPublished },
        { label: 'Published without local city', count: data.seoHealth.missingLocalCity },
      ].filter((x) => x.count > 0),
    [data.seoHealth],
  );

  if (loading) {
    return (
      <DashboardLayout role="digital_marketing">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#023D95] mx-auto" />
            <p className="mt-4 text-slate-600 text-sm">Loading blogs dashboard…</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout role="digital_marketing">
        <div className="rounded-2xl border border-red-200 bg-red-50 text-red-700 text-sm p-4">{error}</div>
      </DashboardLayout>
    );
  }

  const { summary, inventory, dailyPost } = data;
  const dailyAlert = !dailyPost.today_posted || dailyPost.last_status === 'failed' || !dailyPost.enabled || dailyPost.missing_table;

  return (
    <DashboardLayout role="digital_marketing">
      <div className="space-y-3 pb-6">
        <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-slate-900 leading-tight">Blogs dashboard</h1>
            <p className="text-xs text-slate-500">Daily auto-post · SEO · package series</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Link href="/dashboard/digital_marketing/site-seo" className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">
              On-page SEO
            </Link>
            <Link href="/dashboard/digital_marketing/competitors" className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">
              Competitors
            </Link>
            <Link href="/dashboard/digital_marketing/meta-ads" className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">
              Meta Ads
            </Link>
            <Link href="/dashboard/digital_marketing/google-ads" className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">
              <Target className="w-3.5 h-3.5" /> Google Ads
            </Link>
            <Link href="/dashboard/digital_marketing/blogs/ai-create" className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">
              <Sparkles className="w-3.5 h-3.5" /> AI
            </Link>
            <Link href="/dashboard/digital_marketing/blogs/create" className="inline-flex items-center gap-1 rounded-lg bg-[#023D95] px-2.5 py-1 text-xs font-semibold text-white">
              <Plus className="w-3.5 h-3.5" /> New
            </Link>
            <Link href="/blogs" target="_blank" className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-[#023D95]">
              <Eye className="w-3.5 h-3.5" /> Live
            </Link>
          </div>
        </section>

        <DailyBlogScheduleCard compact />

        <section
          className={`rounded-xl border px-3 py-2 ${
            dailyAlert ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'
          }`}
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <p className="text-[11px] text-slate-600 min-w-0 flex-1 truncate">
              {dailyPost.missing_table
                ? 'Cronon job missing — add daily-blog-auto-post'
                : dailyPost.last_blog
                  ? dailyPost.last_blog.title
                  : dailyPost.last_error || 'No daily post yet'}
              {' · '}
              {fmtDateTime(dailyPost.last_run_at)}
            </p>
            <Link href="/dashboard/digital_marketing/blogs" className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">
              All blogs
            </Link>
          </div>
          {dailyPost.recent_runs.length ? (
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-slate-500">
              {dailyPost.recent_runs.slice(0, 3).map((run, idx) => (
                <span key={`${run.run_date}-${idx}`}>
                  {run.run_date.slice(5)} {run.status}
                  {run.topic ? ` · ${run.topic}` : ''}
                </span>
              ))}
            </div>
          ) : null}
        </section>

        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-8 xl:grid-cols-10 gap-1.5">
          <StatChip title="Total" value={summary.total.toLocaleString()} href="/dashboard/digital_marketing/blogs" />
          <StatChip title="Published" value={summary.published.toLocaleString()} href="/dashboard/digital_marketing/blogs?status=published" />
          <StatChip title="Views" value={summary.totalViews.toLocaleString()} />
          <StatChip title="Today" value={summary.publishedToday} />
          <StatChip title="This week" value={summary.publishedThisWeek} />
          <StatChip title="Daily AI" value={summary.dailyAi} />
          <StatChip title="Batch" value={summary.batchAi} />
          <StatChip title="Package" value={summary.packagePosts} />
          <StatChip title="RSA" value={summary.rsaPosts} />
          <StatChip title="USP" value={summary.uspPosts} />
          <StatChip title="Drafts" value={summary.draft} href="/dashboard/digital_marketing/blogs?status=draft" />
          <StatChip title="Review" value={summary.pendingReview} href="/dashboard/digital_marketing/blogs?status=pending_review" />
          <StatChip title="Featured" value={summary.featured} />
          <StatChip title="Archived" value={summary.archived} href="/dashboard/digital_marketing/blogs?status=archived" />
          <StatChip title="Categories" value={inventory.categories} href="/dashboard/digital_marketing/blogs/categories" />
          <StatChip title="Tags" value={inventory.tags} />
          <StatChip title="Comments" value={inventory.comments} />
          <StatChip title="FAQs" value={inventory.faqs.toLocaleString()} />
          <StatChip title="SEO" value={`${data.seoHealth.score}%`} />
          <StatChip title="No city" value={data.seoHealth.missingLocalCity} />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-2.5">
          <div className="rounded-xl border border-[#C9A227]/40 bg-white px-3 py-2">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-semibold text-[#023D95]">Package blogs · {summary.packagePosts}</h2>
              <Link href="/dashboard/digital_marketing/blogs" className="text-[10px] text-[#004AAD] hover:underline">All →</Link>
            </div>
            {data.recentPackage.length ? (
              data.recentPackage.map((b) => <BlogRow key={b.id} blog={b} showAuthor />)
            ) : (
              <p className="text-xs text-slate-500 py-3 text-center">No package blogs yet</p>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-semibold text-[#023D95] inline-flex items-center gap-1">
                <CalendarClock className="w-3.5 h-3.5" /> Recently published
              </h2>
              <Link href="/dashboard/digital_marketing/blogs" className="text-[10px] text-[#004AAD] hover:underline">Manage →</Link>
            </div>
            {data.recentPublished.length ? data.recentPublished.slice(0, 8).map((b) => <BlogRow key={b.id} blog={b} />) : <p className="text-xs text-slate-500 py-3 text-center">Nothing published yet</p>}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-semibold text-[#023D95] inline-flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" /> Top views
              </h2>
              <Link href="/dashboard/digital_marketing/blogs?status=published" className="text-[10px] text-[#004AAD] hover:underline">View all →</Link>
            </div>
            {data.topByViews.length ? data.topByViews.slice(0, 6).map((b) => <BlogRow key={b.id} blog={b} />) : <p className="text-xs text-slate-500 py-3 text-center">No published blogs yet</p>}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-semibold text-[#023D95]">SEO {data.seoHealth.score}%</h2>
              <Link href="/dashboard/digital_marketing/blogs?status=published" className="text-[10px] text-[#004AAD] hover:underline">Fix →</Link>
            </div>
            {seoIssues.length === 0 ? (
              <p className="text-xs text-emerald-700 inline-flex items-center gap-1 py-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> SEO ready
              </p>
            ) : (
              <ul className="space-y-0.5">
                {seoIssues.slice(0, 5).map((issue) => (
                  <li key={issue.label} className="flex items-center justify-between text-[11px] text-slate-600">
                    <span className="truncate pr-2">{issue.label}</span>
                    <span className="font-semibold text-amber-700">{issue.count}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-2 flex flex-wrap gap-1">
              {data.statusBreakdown.map((s) => (
                <Link key={s.status} href={`/dashboard/digital_marketing/blogs?status=${s.status}`} className="rounded-md bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-600">
                  {s.label} {s.count}
                </Link>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {data.categoryBreakdown.slice(0, 6).map((c) => (
                <span key={c.id} className="rounded-md bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-600">
                  {c.name} {c.count}
                </span>
              ))}
            </div>
          </div>
        </div>

        {data.pendingReview.length ? (
          <div className="rounded-xl border border-amber-200 bg-white px-3 py-2">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-semibold text-[#023D95]">Pending review</h2>
              <Link href="/dashboard/digital_marketing/blogs?status=pending_review" className="text-[10px] text-[#004AAD] hover:underline">Review →</Link>
            </div>
            {data.pendingReview.slice(0, 5).map((b) => <BlogRow key={b.id} blog={b} showAuthor />)}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
          <p className="text-[11px] text-slate-600">
            <UserCheck className="w-3.5 h-3.5 inline mr-1" />
            {summary.unassignedAuthor ? `${summary.unassignedAuthor} blogs need author sync` : 'Authors assigned'}
          </p>
          <button type="button" className="rounded-lg bg-[#023D95] px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-60" onClick={syncBlogsToAuthor} disabled={syncingAuthors}>
            {syncingAuthors ? 'Syncing…' : 'Sync authors'}
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}
