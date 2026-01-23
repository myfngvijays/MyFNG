'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import DashboardLayout from '@/components/DashboardLayout';
import { ArrowLeft, Save } from 'lucide-react';

type BlogCategory = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  status: number;
};

function toSlug(input: string) {
  return String(input || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export default function DigitalMarketingEditCategoryPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = String(params?.id || '');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<BlogCategory>({
    id: '',
    name: '',
    slug: '',
    description: '',
    status: 1,
  });

  async function fetchCategory() {
    setLoading(true);
    try {
      const res = await fetch(`/api/blogs/categories/${id}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to load category');
      setForm(data.category as BlogCategory);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load category');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!id) return;
    fetchCategory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function submit() {
    const name = form.name.trim();
    const slug = form.slug.trim() || toSlug(name);
    if (!name || !slug) {
      toast.error('Please fill Name + Slug');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/blogs/categories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          slug,
          description: String(form.description || '').trim() || null,
          status: form.status,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to update category');
      toast.success('Category updated');
      router.push('/dashboard/digital_marketing/blogs/categories');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update category');
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardLayout role="digital_marketing">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/digital_marketing/blogs/categories">
              <button type="button" className="btn btn-outline btn-sm">
                <ArrowLeft className="w-4 h-4" />
              </button>
            </Link>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-text-heading">Edit Blog Category</h1>
              <p className="text-text-body mt-1">Update category details</p>
            </div>
          </div>
          <button type="button" className="btn btn-primary btn-sm flex items-center gap-2" onClick={submit} disabled={saving || loading}>
            <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}
          </button>
        </div>

        {loading ? (
          <div className="card text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading category...</p>
          </div>
        ) : (
          <div className="card space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-heading mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-heading mb-1">
                  Slug <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.slug}
                  onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">Tip: keep it stable once published.</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-heading mb-1">Description</label>
              <textarea
                value={String(form.description || '')}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-heading mb-1">Status</label>
                <select
                  value={String(form.status)}
                  onChange={(e) => setForm((p) => ({ ...p, status: parseInt(e.target.value, 10) }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white"
                >
                  <option value="1">Active</option>
                  <option value="0">Inactive</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

