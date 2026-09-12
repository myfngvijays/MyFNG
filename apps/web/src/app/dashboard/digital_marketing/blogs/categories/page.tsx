'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import DashboardLayout from '@/components/DashboardLayout';
import { Plus, Search, Tag, Edit, Trash2, CheckCircle, XCircle } from 'lucide-react';

type BlogCategory = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  status: number;
  created_at?: string;
  updated_at?: string;
};

export default function DigitalMarketingBlogCategoriesPage() {
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  async function fetchCategories() {
    setLoading(true);
    try {
      const res = await fetch('/api/blogs/categories?manage=1');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to fetch categories');
      setCategories((data?.categories || []) as BlogCategory[]);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to fetch categories');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCategories();
  }, []);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((c) => {
      const hay = `${c.name} ${c.slug} ${c.description || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [categories, searchTerm]);

  async function handleDelete(category: BlogCategory) {
    if (!confirm(`Deactivate category "${category.name}"? (It will be hidden from public selection)`)) return;
    try {
      const res = await fetch(`/api/blogs/categories/${category.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to deactivate category');
      toast.success('Category deactivated');
      fetchCategories();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to deactivate category');
    }
  }

  return (
    <DashboardLayout role="digital_marketing">
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#023D95]">Blog Categories</h1>
            <p className="text-sm text-slate-500 mt-1">Add, edit, or hide categories from the public blog.</p>
          </div>
          <Link href="/dashboard/digital_marketing/blogs/categories/create">
            <button type="button" className="btn btn-primary inline-flex items-center gap-2 w-full sm:w-auto">
              <Plus className="w-5 h-5" />
              Add Category
            </button>
          </Link>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
            <input
              type="text"
              placeholder="Search categories…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#004AAD] focus:border-transparent"
            />
          </div>
          <button
            type="button"
            className="btn btn-outline w-full sm:w-auto"
            onClick={() => void fetchCategories()}
            disabled={loading}
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-slate-100 bg-white py-16 text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-b-2 border-[#004AAD]" />
            <p className="mt-3 text-sm text-slate-500">Loading categories…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-slate-100 bg-white py-14 text-center">
            <Tag className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-[#023D95]">No categories found</h3>
            <p className="text-sm text-slate-500 mb-4">Create your first blog category</p>
            <Link href="/dashboard/digital_marketing/blogs/categories/create">
              <button type="button" className="btn btn-primary">Add Category</button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {filtered.map((c) => (
              <article
                key={c.id}
                className="flex flex-col rounded-2xl border border-[#004AAD]/15 bg-white p-4 shadow-sm hover:shadow-md hover:border-[#004AAD]/30 transition"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F0F7FF] text-[#004AAD]">
                    <Tag className="h-5 w-5" />
                  </div>
                  {c.status === 1 ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                      <CheckCircle className="h-3 w-3" /> Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
                      <XCircle className="h-3 w-3" /> Inactive
                    </span>
                  )}
                </div>
                <h3 className="mt-3 text-base font-extrabold text-[#023D95] leading-snug line-clamp-2">{c.name}</h3>
                <p className="mt-1 font-mono text-[11px] text-slate-500 break-all">/{c.slug}</p>
                {c.description ? (
                  <p className="mt-2 text-xs text-slate-600 line-clamp-2">{c.description}</p>
                ) : (
                  <p className="mt-2 text-xs text-slate-400">No description</p>
                )}
                <div className="mt-auto flex gap-2 pt-4">
                  <Link
                    href={`/dashboard/digital_marketing/blogs/categories/${c.id}/edit`}
                    className="flex-1"
                  >
                    <button
                      type="button"
                      className="inline-flex w-full items-center justify-center gap-1 rounded-xl border border-[#004AAD]/20 bg-[#F0F7FF] px-2 py-2 text-xs font-bold text-[#004AAD]"
                    >
                      <Edit className="h-3.5 w-3.5" />
                      Edit
                    </button>
                  </Link>
                  <button
                    type="button"
                    onClick={() => void handleDelete(c)}
                    disabled={c.status === 0}
                    className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl border border-red-100 bg-red-50 px-2 py-2 text-xs font-bold text-red-700 disabled:opacity-40"
                    title={c.status === 0 ? 'Already inactive' : 'Deactivate'}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {c.status === 0 ? 'Off' : 'Hide'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
