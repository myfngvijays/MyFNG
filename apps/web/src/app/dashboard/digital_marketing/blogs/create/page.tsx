'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { ArrowLeft, Save, Eye, X } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function CreateBlogPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    excerpt: '',
    content: '',
    category_id: '',
    featured_image: '',
    read_time: 3,
    status: 'draft',
    is_featured: false,
    is_premium: false,
    tag_ids: [] as string[],
    image_urls: [] as string[],
    seo_data: {
      meta_title: '',
      meta_description: '',
      keywords: '',
      canonical_url: '',
      og_title: '',
      og_description: '',
      og_image: ''
    }
  });

  useEffect(() => {
    fetchCategories();
    fetchTags();
  }, []);

  // Auto-generate slug from title
  useEffect(() => {
    if (formData.title) {
      const slug = formData.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      setFormData(prev => ({ ...prev, slug }));
    }
  }, [formData.title]);

  async function fetchCategories() {
    try {
      const response = await fetch('/api/blogs/categories');
      if (response.ok) {
        const data = await response.json();
        setCategories(data.categories || []);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  }

  async function fetchTags() {
    try {
      const response = await fetch('/api/blogs/tags');
      if (response.ok) {
        const data = await response.json();
        setTags(data.tags || []);
      }
    } catch (error) {
      console.error('Error fetching tags:', error);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate required fields
      if (!formData.title || !formData.slug || !formData.content) {
        toast.error('Please fill in all required fields');
        setLoading(false);
        return;
      }

      const response = await fetch('/api/blogs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        const data = await response.json();
        toast.success('Blog created successfully');
        router.push(`/dashboard/digital_marketing/blogs/${data.blog.id}/edit`);
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to create blog');
      }
    } catch (error: any) {
      console.error('Error creating blog:', error);
      toast.error('Failed to create blog');
    } finally {
      setLoading(false);
    }
  }

  return (
    <DashboardLayout role="digital_marketing">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
            <Link href="/dashboard/digital_marketing/blogs" className="flex-shrink-0">
              <button className="btn btn-outline btn-sm">
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline ml-1">Back</span>
              </button>
            </Link>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-text-heading">Create New Blog</h1>
              <p className="text-sm sm:text-base text-text-body mt-1">Write and publish a new blog post</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          {/* Basic Information */}
          <div className="card">
            <h2 className="text-base sm:text-lg font-semibold text-text-heading mb-3 sm:mb-4">Basic Information</h2>
            
            <div className="space-y-3 sm:space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-heading mb-1">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                  placeholder="Enter blog title"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-heading mb-1">
                  Slug <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                  placeholder="url-friendly-slug"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">URL-friendly version of the title</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-heading mb-1">Excerpt</label>
                <textarea
                  value={formData.excerpt}
                  onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                  rows={3}
                  placeholder="Short summary of the blog"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-heading mb-1">
                  Content <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent font-mono"
                  rows={15}
                  placeholder="Write your blog content here (HTML supported)"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">You can use HTML tags for formatting</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-heading mb-1">Category</label>
                  <select
                    value={formData.category_id}
                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                  >
                    <option value="">Select category</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-heading mb-1">Read Time (minutes)</label>
                  <input
                    type="number"
                    value={formData.read_time}
                    onChange={(e) => setFormData({ ...formData, read_time: parseInt(e.target.value) || 3 })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                    min="1"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-heading mb-1">Featured Image URL</label>
                <input
                  type="url"
                  value={formData.featured_image}
                  onChange={(e) => setFormData({ ...formData, featured_image: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                  placeholder="https://example.com/image.jpg"
                />
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_featured}
                    onChange={(e) => setFormData({ ...formData, is_featured: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-text-heading">Featured</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_premium}
                    onChange={(e) => setFormData({ ...formData, is_premium: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-text-heading">Premium</span>
                </label>
              </div>
            </div>
          </div>

          {/* Tags */}
          <div className="card">
            <h2 className="text-base sm:text-lg font-semibold text-text-heading mb-3 sm:mb-4">Tags</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
              {tags.map(tag => (
                <label key={tag.id} className="flex items-center gap-2 cursor-pointer p-2 hover:bg-gray-50 rounded">
                  <input
                    type="checkbox"
                    checked={formData.tag_ids.includes(tag.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData({ ...formData, tag_ids: [...formData.tag_ids, tag.id] });
                      } else {
                        setFormData({ ...formData, tag_ids: formData.tag_ids.filter(id => id !== tag.id) });
                      }
                    }}
                    className="w-4 h-4 flex-shrink-0"
                  />
                  <span className="text-sm sm:text-base text-text-heading truncate">{tag.name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* SEO Data */}
          <div className="card">
            <h2 className="text-base sm:text-lg font-semibold text-text-heading mb-3 sm:mb-4">SEO Settings</h2>
            <div className="space-y-3 sm:space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-heading mb-1">Meta Title</label>
                <input
                  type="text"
                  value={formData.seo_data.meta_title}
                  onChange={(e) => setFormData({
                    ...formData,
                    seo_data: { ...formData.seo_data, meta_title: e.target.value }
                  })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                  placeholder="SEO optimized title"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-heading mb-1">Meta Description</label>
                <textarea
                  value={formData.seo_data.meta_description}
                  onChange={(e) => setFormData({
                    ...formData,
                    seo_data: { ...formData.seo_data, meta_description: e.target.value }
                  })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                  rows={2}
                  placeholder="160 character meta description"
                  maxLength={160}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-heading mb-1">Keywords</label>
                <input
                  type="text"
                  value={formData.seo_data.keywords}
                  onChange={(e) => setFormData({
                    ...formData,
                    seo_data: { ...formData.seo_data, keywords: e.target.value }
                  })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                  placeholder="keyword1, keyword2, keyword3"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-heading mb-1">Canonical URL</label>
                <input
                  type="url"
                  value={formData.seo_data.canonical_url}
                  onChange={(e) => setFormData({
                    ...formData,
                    seo_data: { ...formData.seo_data, canonical_url: e.target.value }
                  })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                  placeholder="https://myfng.com/blog/..."
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-heading mb-1">OG Title</label>
                  <input
                    type="text"
                    value={formData.seo_data.og_title}
                    onChange={(e) => setFormData({
                      ...formData,
                      seo_data: { ...formData.seo_data, og_title: e.target.value }
                    })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-heading mb-1">OG Image URL</label>
                  <input
                    type="url"
                    value={formData.seo_data.og_image}
                    onChange={(e) => setFormData({
                      ...formData,
                      seo_data: { ...formData.seo_data, og_image: e.target.value }
                    })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-heading mb-1">OG Description</label>
                <textarea
                  value={formData.seo_data.og_description}
                  onChange={(e) => setFormData({
                    ...formData,
                    seo_data: { ...formData.seo_data, og_description: e.target.value }
                  })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                  rows={2}
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-4">
            <Link href="/dashboard/digital_marketing/blogs">
              <button type="button" className="btn btn-outline">Cancel</button>
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary flex items-center gap-2"
            >
              {loading ? (
                <>Saving...</>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save as Draft
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
