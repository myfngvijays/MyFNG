'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import DashboardLayout from '@/components/DashboardLayout';
import { ArrowLeft, Save, Tag } from 'lucide-react';

function toSlug(input: string) {
  return String(input || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export default function DigitalMarketingCreateCategoryPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    slug: '',
    description: '',
    status: 1,
  });

  useEffect(() => {
    if (!form.name) return;
    setForm((p) => ({ ...p, slug: toSlug(p.name) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.name]);

  async function submit() {
    const name = form.name.trim();
    const slug = form.slug.trim();
    if (!name || !slug) {
      toast.error('Please fill Name + Slug');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/blogs/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          slug,
          description: form.description.trim() || null,
          status: form.status,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to create category');
      toast.success('Category created');
      router.push('/dashboard/digital_marketing/blogs/categories');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to create category');
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
              <h1 className="text-2xl sm:text-3xl font-bold text-text-heading">Add Blog Category</h1>
              <p className="text-text-body mt-1">Create a new category for blog posts</p>
            </div>
          </div>
          <button type="button" className="btn btn-primary btn-sm flex items-center gap-2" onClick={submit} disabled={saving}>
            <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}
          </button>
        </div>

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
                placeholder="e.g. Car Service Tips"
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
                placeholder="e.g. car-service-tips"
              />
              <p className="text-xs text-gray-500 mt-1">Lowercase + hyphens only (auto-generated from name).</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-heading mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
              rows={3}
              placeholder="Optional..."
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
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Tag className="w-4 h-4" />
              Active categories show in Blog create/edit dropdowns.
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

