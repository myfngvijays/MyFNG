'use client';

import { useCallback, useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { formatDateDMY } from '@/lib/utils';
import {
  FileText,
  Plus,
  Edit,
  Eye,
  Clock,
  Calendar,
  BookOpen,
  CheckCircle,
  TrendingUp,
  Send,
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

type BlogCard = {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  status: string;
  views: number;
  read_time: number;
  published_at?: string | null;
  updated_at?: string | null;
  featured_image?: string | null;
  category_name?: string | null;
};

type Summary = {
  total: number;
  published: number;
  draft: number;
  pendingReview: number;
  totalViews: number;
};

export default function DigitalAuthorDashboard() {
  const [blogs, setBlogs] = useState<BlogCard[]>([]);
  const [summary, setSummary] = useState<Summary>({
    total: 0,
    published: 0,
    draft: 0,
    pendingReview: 0,
    totalViews: 0,
  });
  const [loading, setLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/blogs/author-dashboard-stats', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to load blogs');
      setSummary(
        data.summary || { total: 0, published: 0, draft: 0, pendingReview: 0, totalViews: 0 },
      );
      setBlogs(data.recent || []);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load blogs';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    const onFocus = () => loadDashboard();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [loadDashboard]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'published':
        return (
          <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold flex items-center gap-1">
            <CheckCircle className="w-3 h-3" /> Published
          </span>
        );
      case 'pending_review':
        return (
          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold flex items-center gap-1">
            <Send className="w-3 h-3" /> Pending Review
          </span>
        );
      case 'draft':
        return (
          <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-semibold flex items-center gap-1">
            <Clock className="w-3 h-3" /> Draft
          </span>
        );
      default:
        return <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs">{status}</span>;
    }
  };

  if (loading) {
    return (
      <DashboardLayout role="digital_author">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto" />
            <p className="mt-4 text-gray-600">Loading your blogs…</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="digital_author">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-text-heading">My Blogs</h1>
            <p className="text-text-body mt-1 text-sm">Blogs you created — synced live from database</p>
          </div>
          <Link href="/dashboard/digital_author/blogs/create">
            <button type="button" className="btn btn-primary flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Create Blog
            </button>
          </Link>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          <div className="card">
            <p className="text-xs sm:text-sm text-text-body">Total Blogs</p>
            <p className="text-2xl font-bold text-text-heading">{summary.total}</p>
          </div>
          <div className="card">
            <p className="text-xs sm:text-sm text-text-body">Published</p>
            <p className="text-2xl font-bold text-green-600">{summary.published}</p>
          </div>
          <div className="card">
            <p className="text-xs sm:text-sm text-text-body">Drafts</p>
            <p className="text-2xl font-bold text-yellow-600">{summary.draft}</p>
          </div>
          <div className="card">
            <p className="text-xs sm:text-sm text-text-body">Pending Review</p>
            <p className="text-2xl font-bold text-blue-600">{summary.pendingReview}</p>
          </div>
          <div className="card col-span-2 lg:col-span-1">
            <p className="text-xs sm:text-sm text-text-body">Total Views</p>
            <p className="text-2xl font-bold text-purple-600">{summary.totalViews.toLocaleString()}</p>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-text-heading">My Recent Blogs</h2>
            <Link href="/dashboard/digital_author/blogs">
              <button type="button" className="btn btn-sm btn-outline">
                View All
              </button>
            </Link>
          </div>

          {blogs.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-text-heading mb-2">No blogs yet</h3>
              <p className="text-text-body mb-4 text-sm max-w-md mx-auto">
                Only blogs created under your author account appear here. Blogs made from the Digital Marketing login
                won&apos;t show unless they assign you as author.
              </p>
              <Link href="/dashboard/digital_author/blogs/create">
                <button type="button" className="btn btn-primary">
                  Create Blog
                </button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {blogs.map((blog) => (
                <div key={blog.id} className="border border-gray-200 rounded-lg p-3 sm:p-4 hover:shadow-md transition">
                  <div className="flex flex-col lg:flex-row gap-3 sm:gap-4">
                    {blog.featured_image ? (
                      <img src={blog.featured_image} alt={blog.title} className="w-full lg:w-32 h-32 lg:h-24 object-cover rounded-lg shrink-0" />
                    ) : null}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-2">
                        <div className="min-w-0">
                          <h3 className="text-base sm:text-lg font-semibold text-text-heading line-clamp-2">{blog.title}</h3>
                          {blog.excerpt ? <p className="text-text-body text-xs sm:text-sm mt-1 line-clamp-1">{blog.excerpt}</p> : null}
                          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm text-gray-600 mt-2">
                            {blog.category_name ? (
                              <span className="inline-flex items-center gap-1">
                                <BookOpen className="w-3.5 h-3.5" /> {blog.category_name}
                              </span>
                            ) : null}
                            <span className="inline-flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" /> {blog.read_time || 3} min
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Eye className="w-3.5 h-3.5" /> {blog.views} views
                            </span>
                            {(blog.published_at || blog.updated_at) && (
                              <span className="inline-flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5" />
                                {formatDateDMY(blog.published_at || blog.updated_at!)}
                              </span>
                            )}
                          </div>
                        </div>
                        {getStatusBadge(blog.status)}
                      </div>
                      <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-200">
                        <Link href={`/dashboard/digital_author/blogs/${blog.id}`}>
                          <button type="button" className="btn btn-sm btn-outline inline-flex items-center gap-1">
                            <Eye className="w-3.5 h-3.5" /> View
                          </button>
                        </Link>
                        <Link href={`/dashboard/digital_author/blogs/${blog.id}/edit`}>
                          <button type="button" className="btn btn-sm btn-primary inline-flex items-center gap-1">
                            <Edit className="w-3.5 h-3.5" /> Edit
                          </button>
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-xs text-gray-500 text-center">
          Tip: After creating or editing a blog, this page auto-refreshes when you return to this tab.
        </p>
      </div>
    </DashboardLayout>
  );
}
