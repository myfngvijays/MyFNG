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

  const statusBadge = (status: number) => {
    if (status === 1) {
      return (
        <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold flex items-center gap-1">
          <CheckCircle className="w-3 h-3" /> Active
        </span>
      );
    }
    return (
      <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-semibold flex items-center gap-1">
        <XCircle className="w-3 h-3" /> Inactive
      </span>
    );
  };

  return (
    <DashboardLayout role="digital_marketing">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-text-heading">Blog Categories</h1>
            <p className="text-text-body mt-1">Add, edit, and manage blog categories</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <Link href="/dashboard/digital_marketing/blogs/categories/create">
              <button className="btn btn-primary flex items-center gap-2 w-full sm:w-auto">
                <Plus className="w-5 h-5" />
                Add Category
              </button>
            </Link>
          </div>
        </div>

        <div className="card">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <div className="flex-1 relative min-w-0">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5 pointer-events-none" />
              <input
                type="text"
                placeholder="Search categories..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 sm:pl-10 pr-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
              />
            </div>
            <button className="btn btn-outline w-full sm:w-auto" onClick={fetchCategories} disabled={loading}>
              Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <div className="card text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading categories...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="card text-center py-12">
            <Tag className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-text-heading mb-2">No categories found</h3>
            <p className="text-text-body mb-4">Create your first blog category</p>
            <Link href="/dashboard/digital_marketing/blogs/categories/create">
              <button className="btn btn-primary">Add Category</button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((c) => (
              <div key={c.id} className="card hover:shadow-lg transition">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base sm:text-lg font-semibold text-text-heading break-words">{c.name}</h3>
                      {statusBadge(c.status)}
                    </div>
                    <div className="text-xs sm:text-sm text-gray-600 mt-1 break-all">
                      Slug: <span className="font-mono">{c.slug}</span>
                    </div>
                    {c.description ? <p className="text-text-body text-sm mt-2 break-words">{c.description}</p> : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-2 sm:pt-0">
                    <Link href={`/dashboard/digital_marketing/blogs/categories/${c.id}/edit`} className="flex-1 sm:flex-none">
                      <button className="btn btn-sm btn-outline w-full sm:w-auto flex items-center justify-center gap-1">
                        <Edit className="w-3 h-3 sm:w-4 sm:h-4" />
                        <span className="text-xs sm:text-sm">Edit</span>
                      </button>
                    </Link>
                    <button
                      onClick={() => handleDelete(c)}
                      className="btn btn-sm btn-danger flex-1 sm:flex-none w-full sm:w-auto flex items-center justify-center gap-1"
                      disabled={c.status === 0}
                      title={c.status === 0 ? 'Already inactive' : 'Deactivate'}
                    >
                      <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                      <span className="text-xs sm:text-sm">{c.status === 0 ? 'Inactive' : 'Deactivate'}</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

