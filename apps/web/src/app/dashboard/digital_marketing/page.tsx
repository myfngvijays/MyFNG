'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import DashboardLayout from '@/components/DashboardLayout';
import { formatDateDMY } from '@/lib/utils';
import {
  AlertCircle,
  Archive,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  FolderOpen,
  Heart,
  Layers,
  PenLine,
  Plus,
  Sparkles,
  Star,
  Tag,
  TrendingUp,
  Users,
  UserCheck,
} from 'lucide-react';

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
    publishedThisMonth: number;
    createdThisMonth: number;
  };
  inventory: { categories: number; tags: number; comments: number; faqs: number };
  seoHealth: {
    missingMetaDescription: number;
    missingFeaturedImage: number;
    missingFeaturedAlt: number;
    missingExcerpt: number;
    missingFaqsOnPublished: number;
    score: number;
  };
  statusBreakdown: Array<{ status: string; label: string; count: number; color: string }>;
  categoryBreakdown: Array<{ id: string; name: string; slug: string; count: number }>;
  topByViews: BlogCard[];
  pendingReview: BlogCard[];
  recentPublished: BlogCard[];
  recentlyUpdated: BlogCard[];
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
    publishedThisMonth: 0,
    createdThisMonth: 0,
  },
  inventory: { categories: 0, tags: 0, comments: 0, faqs: 0 },
  seoHealth: {
    missingMetaDescription: 0,
    missingFeaturedImage: 0,
    missingFeaturedAlt: 0,
    missingExcerpt: 0,
    missingFaqsOnPublished: 0,
    score: 100,
  },
  statusBreakdown: [],
  categoryBreakdown: [],
  topByViews: [],
  pendingReview: [],
  recentPublished: [],
  recentlyUpdated: [],
};

function fmtDate(v?: string | null) {
  if (!v) return '—';
  return formatDateDMY(new Date(v));
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    published: 'bg-emerald-100 text-emerald-800',
    draft: 'bg-slate-100 text-slate-700',
    pending_review: 'bg-amber-100 text-amber-800',
    archived: 'bg-gray-100 text-gray-600',
  };
  const label =
    status === 'pending_review' ? 'Pending Review' : status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold ${map[status] || map.draft}`}>
      {label}
    </span>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
  accent = 'blue',
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  accent?: 'blue' | 'green' | 'purple' | 'amber' | 'indigo' | 'rose' | 'cyan' | 'slate';
}) {
  const tones: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-emerald-50 text-emerald-600',
    purple: 'bg-purple-50 text-purple-600',
    amber: 'bg-amber-50 text-amber-600',
    indigo: 'bg-indigo-50 text-indigo-600',
    rose: 'bg-rose-50 text-rose-600',
    cyan: 'bg-cyan-50 text-cyan-600',
    slate: 'bg-slate-50 text-slate-600',
  };
  return (
    <div className="card hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs sm:text-sm text-gray-500">{title}</p>
          <p className="text-2xl sm:text-3xl font-bold text-text-heading mt-0.5">{value}</p>
          {subtitle ? <p className="text-[10px] sm:text-xs text-gray-400 mt-1">{subtitle}</p> : null}
        </div>
        <div className={`p-2.5 rounded-xl shrink-0 ${tones[accent]}`}>{icon}</div>
      </div>
    </div>
  );
}

function BlogRow({ blog, showAuthor = false }: { blog: BlogCard; showAuthor?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 py-3 border-b border-gray-100 last:border-0">
      <div className="min-w-0 flex-1">
        <Link href={`/dashboard/digital_marketing/blogs/${blog.id}/edit`} className="font-medium text-sm text-text-heading hover:text-brand-primary line-clamp-2">
          {blog.title}
        </Link>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[11px] text-gray-500">
          {showAuthor ? <span>{blog.author_name}</span> : null}
          <span className="inline-flex items-center gap-1">
            <Eye className="w-3 h-3" /> {blog.views.toLocaleString()}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="w-3 h-3" /> {blog.read_time || 3} min
          </span>
          <span>{fmtDate(blog.published_at || blog.updated_at)}</span>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">{statusBadge(blog.status)}</div>
    </div>
  );
}

export default function DigitalMarketingDashboard() {
  const [data, setData] = useState<DashboardData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [syncingAuthors, setSyncingAuthors] = useState(false);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    setLoading(true);
    try {
      const res = await fetch('/api/blogs/dashboard-stats', { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to load dashboard');
      setData(json as DashboardData);
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

  const maxCategory = useMemo(
    () => Math.max(1, ...data.categoryBreakdown.map((c) => c.count)),
    [data.categoryBreakdown],
  );

  const seoIssues = useMemo(
    () =>
      [
        { label: 'Missing meta description', count: data.seoHealth.missingMetaDescription },
        { label: 'Missing featured image', count: data.seoHealth.missingFeaturedImage },
        { label: 'Missing image ALT text', count: data.seoHealth.missingFeaturedAlt },
        { label: 'Missing excerpt/summary', count: data.seoHealth.missingExcerpt },
        { label: 'Published without FAQs', count: data.seoHealth.missingFaqsOnPublished },
      ].filter((x) => x.count > 0),
    [data.seoHealth],
  );

  if (loading) {
    return (
      <DashboardLayout role="digital_marketing">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto" />
            <p className="mt-4 text-gray-600 text-sm">Loading blogs dashboard…</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout role="digital_marketing">
        <div className="card border-red-200 bg-red-50 text-red-700 text-sm">{error}</div>
      </DashboardLayout>
    );
  }

  const { summary, inventory } = data;

  return (
    <DashboardLayout role="digital_marketing">
      <div className="space-y-5 pb-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-text-heading">Blogs Dashboard</h1>
            <p className="text-sm text-gray-500 mt-1">Real-time stats from your blog database — content, SEO & performance</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/digital_marketing/blogs/ai-create">
              <button type="button" className="btn btn-outline btn-sm inline-flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" /> AI Draft
              </button>
            </Link>
            <Link href="/dashboard/digital_marketing/blogs/create">
              <button type="button" className="btn btn-primary btn-sm inline-flex items-center gap-1.5">
                <Plus className="w-4 h-4" /> New Blog
              </button>
            </Link>
          </div>
        </div>

        <div className="card bg-blue-50 border-blue-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="font-semibold text-text-heading text-sm inline-flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-brand-primary" />
              Author dashboard sync
            </p>
            <p className="text-xs text-gray-600 mt-1 max-w-xl">
              Marketing login se banaye blogs Author par tabhi dikhte hain jab unka <strong>author_id</strong> Digital Author user par set ho.
              Purane blogs ke liye ek baar ye sync chalao.
            </p>
          </div>
          <button type="button" className="btn btn-primary btn-sm shrink-0" onClick={syncBlogsToAuthor} disabled={syncingAuthors}>
            {syncingAuthors ? 'Syncing…' : 'Sync all blogs to Author'}
          </button>
        </div>

        {/* Primary KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard title="Total Blogs" value={summary.total} subtitle={`${summary.createdThisMonth} created this month`} icon={<FileText className="w-5 h-5" />} accent="blue" />
          <StatCard title="Published" value={summary.published} subtitle={`${summary.publishedThisMonth} this month`} icon={<CheckCircle2 className="w-5 h-5" />} accent="green" />
          <StatCard title="Total Views" value={summary.totalViews.toLocaleString()} subtitle={`Avg ${summary.avgViews} per blog`} icon={<Eye className="w-5 h-5" />} accent="indigo" />
          <StatCard title="Pending Review" value={summary.pendingReview} subtitle={summary.pendingReview ? 'Needs your action' : 'All clear'} icon={<Clock className="w-5 h-5" />} accent="amber" />
        </div>

        {/* Secondary KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <StatCard title="Drafts" value={summary.draft} icon={<PenLine className="w-4 h-4" />} accent="slate" />
          <StatCard title="Featured" value={summary.featured} icon={<Star className="w-4 h-4" />} accent="amber" />
          <StatCard title="Premium" value={summary.premium} icon={<Layers className="w-4 h-4" />} accent="purple" />
          <StatCard title="Archived" value={summary.archived} icon={<Archive className="w-4 h-4" />} accent="slate" />
          <StatCard title="Categories" value={inventory.categories} icon={<FolderOpen className="w-4 h-4" />} accent="cyan" />
          <StatCard title="Tags" value={inventory.tags} icon={<Tag className="w-4 h-4" />} accent="blue" />
          <StatCard title="Comments" value={inventory.comments} icon={<Users className="w-4 h-4" />} accent="green" />
          <StatCard title="Total Likes" value={summary.totalLikes.toLocaleString()} icon={<Heart className="w-4 h-4" />} accent="rose" />
        </div>

        {/* Quick Actions + Status */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="card lg:col-span-2">
            <h2 className="text-base font-semibold text-text-heading mb-3">Quick Actions</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Link href="/dashboard/digital_marketing/blogs/create" className="btn btn-primary btn-sm justify-center">
                <Plus className="w-4 h-4" /> Create
              </Link>
              <Link href="/dashboard/digital_marketing/blogs" className="btn btn-outline btn-sm justify-center">
                <BookOpen className="w-4 h-4" /> All Blogs
              </Link>
              <Link href="/dashboard/digital_marketing/blogs/categories" className="btn btn-outline btn-sm justify-center">
                <FolderOpen className="w-4 h-4" /> Categories
              </Link>
              <Link href="/blogs" target="_blank" className="btn btn-outline btn-sm justify-center">
                <Eye className="w-4 h-4" /> Live Site
              </Link>
            </div>

            <h3 className="text-sm font-semibold text-text-heading mt-5 mb-3">Content by Status</h3>
            <div className="space-y-2.5">
              {data.statusBreakdown.map((s) => (
                <div key={s.status}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-600">{s.label}</span>
                    <span className="font-semibold">{s.count}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${s.color}`}
                      style={{ width: `${summary.total ? (s.count / summary.total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-text-heading">SEO Health</h2>
              <span
                className={`text-lg font-bold ${data.seoHealth.score >= 80 ? 'text-emerald-600' : data.seoHealth.score >= 60 ? 'text-amber-600' : 'text-red-600'}`}
              >
                {data.seoHealth.score}%
              </span>
            </div>
            {seoIssues.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-lg p-3">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                All blogs look SEO-ready
              </div>
            ) : (
              <ul className="space-y-2">
                {seoIssues.map((issue) => (
                  <li key={issue.label} className="flex items-center justify-between text-xs sm:text-sm">
                    <span className="inline-flex items-center gap-1.5 text-gray-600">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                      {issue.label}
                    </span>
                    <span className="font-semibold text-amber-700">{issue.count}</span>
                  </li>
                ))}
              </ul>
            )}
            <Link href="/dashboard/digital_marketing/blogs?status=draft" className="text-xs text-brand-primary hover:underline mt-3 inline-block">
              Fix in blog editor →
            </Link>
          </div>
        </div>

        {/* Main content grid */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="card">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-base font-semibold text-text-heading inline-flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-brand-primary" /> Top by Views
              </h2>
              <Link href="/dashboard/digital_marketing/blogs?status=published" className="text-xs text-brand-primary hover:underline">
                View all →
              </Link>
            </div>
            {data.topByViews.length ? data.topByViews.map((b) => <BlogRow key={b.id} blog={b} />) : <p className="text-sm text-gray-500 py-6 text-center">No published blogs yet</p>}
          </div>

          <div className="card border-amber-200/60">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-base font-semibold text-text-heading inline-flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600" /> Pending Review
              </h2>
              <Link href="/dashboard/digital_marketing/blogs?status=pending_review" className="text-xs text-brand-primary hover:underline">
                Review all →
              </Link>
            </div>
            {data.pendingReview.length ? (
              data.pendingReview.map((b) => <BlogRow key={b.id} blog={b} showAuthor />)
            ) : (
              <p className="text-sm text-gray-500 py-6 text-center">No blogs waiting for review</p>
            )}
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-base font-semibold text-text-heading">Recently Published</h2>
              <Link href="/dashboard/digital_marketing/blogs" className="text-xs text-brand-primary hover:underline">
                Manage →
              </Link>
            </div>
            {data.recentPublished.length ? data.recentPublished.map((b) => <BlogRow key={b.id} blog={b} />) : <p className="text-sm text-gray-500 py-6 text-center">Nothing published yet</p>}
          </div>

          <div className="card">
            <h2 className="text-base font-semibold text-text-heading mb-3 inline-flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-brand-primary" /> Top Categories
            </h2>
            {data.categoryBreakdown.length ? (
              <div className="space-y-3">
                {data.categoryBreakdown.map((c) => (
                  <div key={c.id}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-700 truncate pr-2">{c.name}</span>
                      <span className="font-semibold shrink-0">{c.count}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-brand-primary rounded-full" style={{ width: `${(c.count / maxCategory) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 py-4 text-center">No categories assigned yet</p>
            )}
            <Link href="/dashboard/digital_marketing/blogs/categories" className="text-xs text-brand-primary hover:underline mt-3 inline-block">
              Manage categories →
            </Link>
          </div>
        </div>

        {/* Recent activity table */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-text-heading">Recent Activity</h2>
            <span className="text-xs text-gray-400">Last updated blogs</span>
          </div>
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                  <th className="pb-2 font-medium px-4 sm:px-0">Title</th>
                  <th className="pb-2 font-medium">Author</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Views</th>
                  <th className="pb-2 font-medium">Updated</th>
                  <th className="pb-2 font-medium text-right px-4 sm:px-0">Action</th>
                </tr>
              </thead>
              <tbody>
                {data.recentlyUpdated.map((b) => (
                  <tr key={b.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="py-3 px-4 sm:px-0 max-w-[220px]">
                      <p className="font-medium text-text-heading truncate">{b.title}</p>
                    </td>
                    <td className="py-3 text-gray-600 text-xs">{b.author_name}</td>
                    <td className="py-3">{statusBadge(b.status)}</td>
                    <td className="py-3 text-gray-600">{b.views.toLocaleString()}</td>
                    <td className="py-3 text-gray-500 text-xs whitespace-nowrap">{fmtDate(b.updated_at)}</td>
                    <td className="py-3 text-right px-4 sm:px-0">
                      <Link href={`/dashboard/digital_marketing/blogs/${b.id}/edit`} className="text-xs text-brand-primary hover:underline">
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.recentlyUpdated.length ? <p className="text-sm text-gray-500 py-8 text-center">No blog activity yet</p> : null}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
