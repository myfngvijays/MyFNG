'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import toast from 'react-hot-toast';
import DashboardLayout from '@/components/DashboardLayout';
import { formatDateDMY } from '@/lib/utils';
import { normalizeBlogMediaUrl } from '@/lib/blog/normalizeBlogMedia';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Sparkles,
  ArrowRight,
  CheckCircle,
} from 'lucide-react';
import DailyBlogScheduleCard from '@/components/blog/DailyBlogScheduleCard';

interface Blog {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  status: string;
  views: number;
  read_time: number;
  created_at: string;
  published_at?: string;
  category?: { id?: string; name: string; slug: string };
  tags?: Array<{ name: string; slug: string }>;
  featured_image?: string;
}

function getVisiblePageNumbers(currentPage: number, totalPages: number, maxVisible = 5): number[] {
  if (totalPages <= maxVisible) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  if (currentPage <= 3) {
    return Array.from({ length: maxVisible }, (_, i) => i + 1);
  }
  if (currentPage >= totalPages - 2) {
    return Array.from({ length: maxVisible }, (_, i) => totalPages - maxVisible + i + 1);
  }
  return Array.from({ length: maxVisible }, (_, i) => currentPage - 2 + i);
}

export default function BlogsPage() {
  return (
    <Suspense
      fallback={
        <DashboardLayout role="digital_marketing">
          <div className="flex min-h-[40vh] items-center justify-center text-sm text-gray-500">
            Loading blogs…
          </div>
        </DashboardLayout>
      }
    >
      <BlogsPageContent />
    </Suspense>
  );
}

function BlogsPageContent() {
  const searchParams = useSearchParams();
  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>(() => searchParams.get('status') || 'all');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 8, total: 0, totalPages: 0 });
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 350);
    return () => clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    const status = searchParams.get('status');
    if (status && status !== filter) setFilter(status);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    void fetchCategories();
  }, []);

  useEffect(() => {
    void fetchBlogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, debouncedSearch, pagination.page, selectedCategory]);

  async function fetchCategories() {
    try {
      const response = await fetch('/api/blogs/categories');
      if (response.ok) {
        const data = await response.json();
        setCategories(data.categories || []);
      }
    } catch {
      /* ignore */
    }
  }

  async function fetchBlogs() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== 'all') params.append('status', filter);
      if (debouncedSearch) params.append('search', debouncedSearch);
      if (selectedCategory) params.append('category_id', selectedCategory);
      params.append('page', pagination.page.toString());
      params.append('limit', '8');

      const response = await fetch(`/api/blogs?${params.toString()}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'Failed to fetch blogs');
      setBlogs(data.blogs || []);
      setPagination(data.pagination || { ...pagination, limit: 8 });
    } catch (error: any) {
      toast.error(error?.message || 'Failed to fetch blogs');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(blogId: string, title: string) {
    if (!confirm(`Delete “${title}”? This cannot be undone.`)) return;
    try {
      const response = await fetch(`/api/blogs/${blogId}`, { method: 'DELETE' });
      const error = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(error?.error || 'Failed to delete blog');
      toast.success('Blog deleted');
      void fetchBlogs();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to delete blog');
    }
  }

  async function handlePublish(blogId: string) {
    try {
      const response = await fetch(`/api/blogs/${blogId}/publish`, { method: 'POST' });
      const error = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(error?.error || 'Failed to publish blog');
      toast.success('Blog published');
      void fetchBlogs();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to publish blog');
    }
  }

  const startIndex = pagination.total === 0 ? 0 : (pagination.page - 1) * 8 + 1;
  const endIndex = Math.min(pagination.page * 8, pagination.total);

  return (
    <DashboardLayout role="digital_marketing">
      <div className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-brand-secondary sm:text-3xl">Blogs</h1>
            <p className="mt-1 text-sm text-gray-500">Create, edit, and publish posts</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link href="/dashboard/digital_marketing/blogs/ai-create">
              <button type="button" className="btn btn-outline inline-flex w-full items-center justify-center gap-2 sm:w-auto">
                <Sparkles className="h-4 w-4" />
                AI Write
              </button>
            </Link>
            <Link href="/dashboard/digital_marketing/blogs/create">
              <button type="button" className="btn btn-primary inline-flex w-full items-center justify-center gap-2 sm:w-auto">
                <Plus className="h-5 w-5" />
                Create Blog
              </button>
            </Link>
          </div>
        </div>

        <DailyBlogScheduleCard />

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 sm:left-4 sm:h-5 sm:w-5" />
          <input
            type="text"
            placeholder="Search blogs..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPagination((p) => ({ ...p, page: 1 }));
            }}
            className="w-full rounded-xl border border-gray-300 py-2.5 pl-10 pr-4 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-primary sm:py-3 sm:pl-12 sm:text-base"
          />
        </div>

        <div className="flex flex-wrap gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => {
              setSelectedCategory('');
              setPagination((p) => ({ ...p, page: 1 }));
            }}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all sm:px-6 sm:py-2 sm:text-sm ${
              selectedCategory === ''
                ? 'bg-brand-primary text-white shadow-lg'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All
          </button>
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => {
                setSelectedCategory(category.id);
                setPagination((p) => ({ ...p, page: 1 }));
              }}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all sm:px-6 sm:py-2 sm:text-sm ${
                selectedCategory === category.id
                  ? 'bg-brand-primary text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {category.name}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            { id: 'all', label: 'All status' },
            { id: 'published', label: 'Published' },
            { id: 'draft', label: 'Drafts' },
            { id: 'pending_review', label: 'Pending' },
            { id: 'archived', label: 'Archived' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setFilter(tab.id);
                setPagination((p) => ({ ...p, page: 1 }));
              }}
              className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                filter === tab.id ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 ring-1 ring-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-16 text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-brand-primary" />
            <p className="text-gray-500">Loading blogs...</p>
          </div>
        ) : blogs.length === 0 ? (
          <div className="py-16 text-center text-gray-500">No blog posts found matching your criteria.</div>
        ) : (
          <>
            <div className="text-xs text-gray-600 sm:text-sm">
              Showing{' '}
              <span className="font-semibold">
                {startIndex}-{endIndex}
              </span>{' '}
              of <span className="font-semibold">{pagination.total}</span> blogs
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4 md:gap-8">
              {blogs.map((blog) => {
                const href =
                  blog.status === 'published'
                    ? `/blogs/${blog.slug}`
                    : `/dashboard/digital_marketing/blogs/${blog.id}`;
                const imageSrc = blog.featured_image
                  ? normalizeBlogMediaUrl(blog.featured_image) || blog.featured_image
                  : '';
                return (
                  <article
                    key={blog.id}
                    className="group overflow-hidden rounded-xl bg-white shadow-lg transition-all hover:shadow-xl sm:rounded-2xl"
                  >
                    <Link href={href} className="block">
                      <div className="relative aspect-video overflow-hidden bg-gray-200">
                        {imageSrc ? (
                          <Image
                            src={imageSrc}
                            alt={blog.title}
                            fill
                            className="object-cover transition duration-500 group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-primary to-blue-600">
                            <span className="text-4xl font-bold text-white">
                              {blog.title.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                        {blog.category ? (
                          <div className="absolute left-3 top-3 sm:left-4 sm:top-4">
                            <span className="rounded-full bg-brand-primary px-2 py-0.5 text-[10px] font-semibold text-white sm:px-3 sm:py-1 sm:text-xs">
                              {blog.category.name}
                            </span>
                          </div>
                        ) : null}
                      </div>
                    </Link>

                    <div className="p-4 sm:p-5 md:p-6">
                      <p className="mb-2 whitespace-nowrap text-[10px] leading-4 text-gray-500 sm:mb-3 sm:text-[11px]">
                        {blog.published_at || blog.created_at
                          ? `${formatDateDMY(blog.published_at || blog.created_at)} · `
                          : ''}
                        {blog.read_time || 3} min · {Number(blog.views || 0).toLocaleString('en-IN')} views
                      </p>

                      <Link href={href} className="block">
                        <h3 className="mb-2 line-clamp-2 text-base font-bold text-brand-secondary transition group-hover:text-brand-primary sm:mb-3 sm:text-lg md:text-xl">
                          {blog.title}
                        </h3>
                      </Link>

                      {blog.excerpt ? (
                        <p className="mb-3 line-clamp-3 text-xs text-gray-600 sm:mb-4 sm:text-sm">{blog.excerpt}</p>
                      ) : null}

                      {blog.tags && blog.tags.length > 0 ? (
                        <div className="mb-3 flex flex-wrap gap-1.5 sm:mb-4">
                          {blog.tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag.slug || tag.name}
                              className="rounded bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600 sm:text-xs"
                            >
                              {tag.name}
                            </span>
                          ))}
                        </div>
                      ) : null}

                      <Link
                        href={href}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-primary sm:gap-2 sm:text-sm"
                      >
                        Read More <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1 sm:h-4 sm:w-4" />
                      </Link>

                      <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-3">
                        <Link
                          href={`/dashboard/digital_marketing/blogs/${blog.id}/edit`}
                          className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-gray-100 px-2 py-1.5 text-[11px] font-semibold text-gray-700"
                        >
                          <Edit className="h-3 w-3" /> Edit
                        </Link>
                        {blog.status === 'draft' || blog.status === 'pending_review' ? (
                          <button
                            type="button"
                            onClick={() => void handlePublish(blog.id)}
                            className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-brand-primary px-2 py-1.5 text-[11px] font-semibold text-white"
                          >
                            <CheckCircle className="h-3 w-3" />
                            Publish
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => void handleDelete(blog.id, blog.title)}
                          className="inline-flex items-center justify-center rounded-lg bg-red-50 px-2 py-1.5 text-red-600"
                          aria-label="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            {pagination.totalPages > 1 ? (
              <div className="mt-8 flex items-center justify-center gap-2 px-2">
                <button
                  type="button"
                  onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
                  disabled={pagination.page === 1}
                  className="whitespace-nowrap rounded-md border border-gray-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Prev
                </button>
                <span className="whitespace-nowrap text-sm text-gray-600 sm:hidden">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <div className="hidden items-center gap-2 sm:flex">
                  {getVisiblePageNumbers(pagination.page, pagination.totalPages).map((page) => (
                    <button
                      key={page}
                      type="button"
                      onClick={() => setPagination((p) => ({ ...p, page }))}
                      className={`min-w-[2.25rem] rounded-md border px-3 py-2 text-sm ${
                        pagination.page === page
                          ? 'border-brand-primary bg-brand-primary text-white'
                          : 'border-gray-300 text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                  disabled={pagination.page >= pagination.totalPages}
                  className="whitespace-nowrap rounded-md border border-gray-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
