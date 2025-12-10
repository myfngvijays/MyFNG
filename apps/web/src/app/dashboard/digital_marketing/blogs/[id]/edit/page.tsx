'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { ArrowLeft, Save, Eye, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function EditBlogPage() {
  const router = useRouter();
  const params = useParams();
  const blogId = params.id as string;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [versions, setVersions] = useState<any[]>([]);
  
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
    if (blogId) {
      fetchBlog();
      fetchCategories();
      fetchTags();
      fetchVersions();
    }
  }, [blogId]);

  async function fetchBlog() {
    setLoading(true);
    try {
      const response = await fetch(`/api/blogs/${blogId}`);
      if (response.ok) {
        const data = await response.json();
        const blog = data.blog;
        setFormData({
          title: blog.title || '',
          slug: blog.slug || '',
          excerpt: blog.excerpt || '',
          content: blog.content || '',
          category_id: blog.category_id || '',
          featured_image: blog.featured_image || '',
          read_time: blog.read_time || 3,
          status: blog.status || 'draft',
          is_featured: blog.is_featured || false,
          is_premium: blog.is_premium || false,
          tag_ids: blog.tags?.map((t: any) => t.id) || [],
          image_urls: blog.images?.map((img: any) => img.image_url) || [],
          seo_data: blog.seo_data || {
            meta_title: '',
            meta_description: '',
            keywords: '',
            canonical_url: '',
            og_title: '',
            og_description: '',
            og_image: ''
          }
        });
      } else {
        toast.error('Failed to load blog');
        router.push('/dashboard/digital_marketing/blogs');
      }
    } catch (error) {
      console.error('Error fetching blog:', error);
      toast.error('Failed to load blog');
    } finally {
      setLoading(false);
    }
  }

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

  async function fetchVersions() {
    try {
      const response = await fetch(`/api/blogs/${blogId}/versions`);
      if (response.ok) {
        const data = await response.json();
        setVersions(data.versions || []);
      }
    } catch (error) {
      console.error('Error fetching versions:', error);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const response = await fetch(`/api/blogs/${blogId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        toast.success('Blog updated successfully');
        fetchBlog();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to update blog');
      }
    } catch (error: any) {
      console.error('Error updating blog:', error);
      toast.error('Failed to update blog');
    } finally {
      setSaving(false);
    }
  }

  async function handleRestoreVersion(versionId: string) {
    if (!confirm('Are you sure you want to restore this version? Current changes will be lost.')) {
      return;
    }

    try {
      const response = await fetch(`/api/blogs/${blogId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version_id: versionId })
      });

      if (response.ok) {
        toast.success('Version restored successfully');
        fetchBlog();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to restore version');
      }
    } catch (error: any) {
      console.error('Error restoring version:', error);
      toast.error('Failed to restore version');
    }
  }

  if (loading) {
    return (
      <DashboardLayout role="digital_marketing">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading blog...</p>
          </div>
        </div>
      </DashboardLayout>
    );
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
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-text-heading">Edit Blog</h1>
              <p className="text-sm sm:text-base text-text-body mt-1">Update blog content and settings</p>
            </div>
          </div>
          <div className="flex-shrink-0">
            <Link href={`/dashboard/digital_marketing/blogs/${blogId}`}>
              <button className="btn btn-outline btn-sm w-full sm:w-auto flex items-center justify-center gap-2">
                <Eye className="w-4 h-4" />
                <span className="text-sm">View</span>
              </button>
            </Link>
          </div>
        </div>

        {/* Version History */}
        {versions.length > 0 && (
          <div className="card bg-yellow-50 border-yellow-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
              <div className="flex-1 min-w-0">
                <h3 className="text-base sm:text-lg font-semibold text-text-heading">Version History</h3>
                <p className="text-xs sm:text-sm text-gray-600">Restore previous versions if needed</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {versions.slice(0, 3).map((version) => (
                  <button
                    key={version.id}
                    onClick={() => handleRestoreVersion(version.id)}
                    className="btn btn-sm btn-outline flex items-center gap-2"
                  >
                    <RotateCcw className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                    <span className="text-xs sm:text-sm">Version {version.version_number}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          {/* Same form structure as create page */}
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
                  className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
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
                  className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-heading mb-1">Excerpt</label>
                <textarea
                  value={formData.excerpt}
                  onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
                  className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-heading mb-1">
                  Content <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent font-mono resize-y"
                  rows={12}
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-heading mb-1">Category</label>
                  <select
                    value={formData.category_id}
                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                    className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
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
                    className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                    min="1"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-heading mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-heading mb-1">Featured Image URL</label>
                <input
                  type="url"
                  value={formData.featured_image}
                  onChange={(e) => setFormData({ ...formData, featured_image: e.target.value })}
                  className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                />
              </div>

              <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_featured}
                    onChange={(e) => setFormData({ ...formData, is_featured: e.target.checked })}
                    className="w-4 h-4 flex-shrink-0"
                  />
                  <span className="text-sm sm:text-base text-text-heading">Featured</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_premium}
                    onChange={(e) => setFormData({ ...formData, is_premium: e.target.checked })}
                    className="w-4 h-4 flex-shrink-0"
                  />
                  <span className="text-sm sm:text-base text-text-heading">Premium</span>
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

          {/* SEO Data - Same as create page */}
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
                  className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
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
                  className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                  rows={2}
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
                  className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
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
                  className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
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
                    className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
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
                    className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
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
                  className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                  rows={2}
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3 sm:gap-4">
            <Link href="/dashboard/digital_marketing/blogs" className="w-full sm:w-auto">
              <button type="button" className="btn btn-outline w-full sm:w-auto">Cancel</button>
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary w-full sm:w-auto flex items-center justify-center gap-2"
            >
              {saving ? 'Saving...' : (
                <>
                  <Save className="w-4 h-4" />
                  <span className="text-sm sm:text-base">Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
