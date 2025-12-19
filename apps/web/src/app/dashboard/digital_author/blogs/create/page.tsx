'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { ArrowLeft, Eye, Loader2, Plus, Save, Trash2, UploadCloud } from 'lucide-react';

export default function CreateBlogPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [uploadingFeatured, setUploadingFeatured] = useState(false);

  type ContentBlock = {
    id: string;
    heading: string;
    image_url?: string;
    body_html: string; // HTML supported
  };

  type FaqItem = {
    id: string;
    question: string;
    answer: string;
  };

  function uid() {
    try {
      return crypto.randomUUID();
    } catch {
      return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }
  }

  const CITY_MAP: Record<string, string[]> = useMemo(
    () => ({
      Pune: ['Wakad', 'Baner', 'Hinjewadi', 'Kothrud', 'Viman Nagar', 'Kharadi', 'Pimpri'],
      Mumbai: ['Andheri', 'Bandra', 'Borivali', 'Juhu', 'Colaba', 'Powai', 'Dadar'],
      Nashik: ['Panchavati', 'Cidco', 'Satpur', 'Indira Nagar', 'Deolali', 'Gangapur Road'],
    }),
    []
  );

  const [contentBlocks, setContentBlocks] = useState<ContentBlock[]>([
    { id: uid(), heading: '', image_url: '', body_html: '' },
  ]);
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [primaryCity, setPrimaryCity] = useState('Pune');
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  
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
      og_image: '',
      // Extra fields (JSON) - safe to store in seo_data
      search_intent: 'Informational',
      schema_blogposting: true,
      schema_faq: true,
      eligible_ai_overview: true,
      author_name: 'MyFNG Auto Expert Team',
      author_role: 'Automotive Expert',
      cta_text: 'Book Your Car Service Now',
      cta_url: 'https://myfng.in/book-service',
      robots_index: true,
      robots_follow: true,
      local_city: 'Pune',
      local_areas: [] as string[],
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

  // Keep local seo fields mirrored into seo_data
  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      seo_data: {
        ...prev.seo_data,
        local_city: primaryCity,
        local_areas: selectedAreas,
      } as any,
    }));
  }, [primaryCity, selectedAreas]);

  // Build content HTML from content blocks + FAQ
  const generatedHtml = useMemo(() => {
    function escapeText(s: string) {
      return String(s || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    const blocksHtml = (contentBlocks || [])
      .filter((b) => (b.heading || '').trim() || (b.body_html || '').trim() || (b.image_url || '').trim())
      .map((b) => {
        const h = (b.heading || '').trim();
        const img = (b.image_url || '').trim();
        const body = (b.body_html || '').trim();
        return [
          '<section>',
          h ? `<h2>${escapeText(h)}</h2>` : '',
          img ? `<p><img src="${escapeText(img)}" alt="${escapeText(h || 'Section image')}" /></p>` : '',
          body || '',
          '</section>',
        ]
          .filter(Boolean)
          .join('\n');
      })
      .join('\n\n');

    const faqHtml =
      faqs.length > 0
        ? [
            '<section>',
            '<h2>FAQ</h2>',
            ...faqs
              .filter((f) => (f.question || '').trim() || (f.answer || '').trim())
              .map((f) => {
                const q = escapeText((f.question || '').trim());
                const a = escapeText((f.answer || '').trim());
                return [q ? `<h3>${q}</h3>` : '', a ? `<p>${a}</p>` : ''].filter(Boolean).join('\n');
              }),
            '</section>',
          ].join('\n')
        : '';

    return [blocksHtml, faqHtml].filter(Boolean).join('\n\n').trim();
  }, [contentBlocks, faqs]);

  useEffect(() => {
    // Keep formData.content in sync so submit validation passes
    setFormData((prev) => ({ ...prev, content: generatedHtml }));
  }, [generatedHtml]);

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

  async function uploadFeaturedImage(file: File) {
    const slug = (formData.slug || '').trim();
    if (!slug) {
      toast.error('Please enter Title/Slug before uploading featured image.');
      return;
    }
    try {
      setUploadingFeatured(true);
      const fd = new FormData();
      fd.append('file', file);
      fd.append('slug', slug);
      const res = await fetch('/api/blogs/upload-featured-image', { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to upload image');

      const url = String(data?.url || '');
      if (!url) throw new Error('Upload succeeded but no URL returned');

      setFormData((prev) => ({
        ...prev,
        featured_image: url,
        seo_data: { ...prev.seo_data, og_image: prev.seo_data.og_image || url } as any,
      }));
      toast.success('Featured image uploaded');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to upload image');
    } finally {
      setUploadingFeatured(false);
    }
  }

  async function submitBlog(statusOverride?: string) {
    setLoading(true);

    try {
      const payload = {
        ...formData,
        status: statusOverride ?? formData.status,
        // Always submit generated HTML
        content: generatedHtml,
      };

      // Validate required fields
      if (!payload.title || !payload.slug || !payload.content) {
        toast.error('Please fill Title + Slug + at least 1 content section');
        return;
      }

      const response = await fetch('/api/blogs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const data = await response.json();
        toast.success('Blog created successfully');
        router.push(`/dashboard/digital_author/blogs/${data.blog.id}/edit`);
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
    <DashboardLayout role="digital_author">
      <div className="bg-slate-50 -m-4 sm:-m-6 p-4 sm:p-6">
        {/* Topbar (sticky) */}
        <div className="sticky top-0 z-20 bg-white border border-slate-200 rounded-xl shadow-sm px-4 py-3 mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Link href="/dashboard/digital_author/blogs" className="flex-shrink-0">
                <button type="button" className="btn btn-outline btn-sm">
                  <ArrowLeft className="w-4 h-4" />
                </button>
              </Link>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-bold text-text-heading truncate">New Blog Post</h1>
                <p className="text-xs sm:text-sm text-text-body truncate">MyFNG Blog Admin Editor</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 justify-end">
              <button
                type="button"
                className="btn btn-outline btn-sm"
                disabled={loading}
                onClick={() => submitBlog('draft')}
                title="Save Draft"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span className="ml-2">Save Draft</span>
              </button>

              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setShowPreview(true)}
                disabled={loading}
                title="Preview"
              >
                <Eye className="w-4 h-4" />
                <span className="ml-2">Preview</span>
              </button>

              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={loading}
                onClick={() => submitBlog('published')}
                title="Publish Post"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span className="ml-2">Publish Post</span>
              </button>
            </div>
          </div>
        </div>

        {/* Main layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6 max-w-[1440px] mx-auto">
          <main className="lg:col-span-2 space-y-4 lg:space-y-6">
            {/* 1. Core Content */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 sm:p-5">
              <h2 className="text-sm font-bold tracking-wide uppercase text-slate-900 border-b border-slate-200 pb-2 mb-4">
                1. Core Content
              </h2>

              <label className="block text-sm font-semibold text-slate-900 mb-1">
                Main Title (H1) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                placeholder="e.g. Best Car Service in Pune – Prices & Expert Tips"
              />

              <div className="mt-4">
                <label className="block text-sm font-semibold text-slate-900 mb-1">Featured Image</label>
                <div className="border-2 border-dashed border-slate-200 rounded-lg p-4 text-center bg-slate-50 hover:bg-blue-50 hover:border-brand-primary transition relative">
                  <div className="flex flex-col items-center gap-1">
                    <UploadCloud className="w-6 h-6 text-slate-500" />
                    <div className="text-xs text-slate-600">
                      {uploadingFeatured ? 'Uploading...' : 'Click to upload featured image (filename will be slug.ext)'}
                    </div>
                    {formData.featured_image ? (
                      <div className="mt-2 w-full">
                        <img
                          src={formData.featured_image}
                          alt="Featured preview"
                          className="w-full max-h-48 object-cover rounded-md border"
                        />
                        <div className="text-[11px] text-slate-500 mt-1 break-all">{formData.featured_image}</div>
                      </div>
                    ) : null}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    disabled={uploadingFeatured || loading}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      uploadFeaturedImage(f);
                      e.currentTarget.value = '';
                    }}
                  />
                </div>

                <div className="mt-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Featured Image URL (optional override)</label>
                  <input
                    type="url"
                    value={formData.featured_image}
                    onChange={(e) => setFormData({ ...formData, featured_image: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                    placeholder="https://.../your-slug.webp"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Note: If hosted on `myfng.*` / Supabase, filename must match slug (backend validation).
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-1">
                    URL Slug <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                    placeholder="best-car-service-in-pune"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-1">Category</label>
                  <select
                    value={formData.category_id}
                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                  >
                    <option value="">Select category</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-semibold text-slate-900 mb-1">AI Summary (40–60 words)</label>
                <textarea
                  value={formData.excerpt}
                  onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-brand-primary focus:border-transparent resize-y"
                  rows={3}
                  placeholder="Summarize the value of this post..."
                />
              </div>
            </div>

            {/* 2. Content Blocks */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 sm:p-5">
              <h2 className="text-sm font-bold tracking-wide uppercase text-slate-900 border-b border-slate-200 pb-2 mb-4">
                2. Content Blocks
              </h2>

              <div className="space-y-3">
                {contentBlocks.map((b, idx) => (
                  <div key={b.id} className="border border-slate-200 rounded-xl bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-slate-900">Section #{idx + 1}</div>
                      <button
                        type="button"
                        className="text-xs text-red-600 hover:underline inline-flex items-center gap-1"
                        onClick={() => setContentBlocks((prev) => prev.filter((x) => x.id !== b.id))}
                        disabled={contentBlocks.length <= 1}
                        title={contentBlocks.length <= 1 ? 'At least 1 section is required' : 'Remove section'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Remove
                      </button>
                    </div>

                    <label className="block text-sm font-semibold text-slate-900 mt-3 mb-1">Section Heading</label>
                    <input
                      type="text"
                      value={b.heading}
                      onChange={(e) =>
                        setContentBlocks((prev) => prev.map((x) => (x.id === b.id ? { ...x, heading: e.target.value } : x)))
                      }
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                      placeholder="Why Choosing the Right Car Service Matters"
                    />

                    <label className="block text-sm font-semibold text-slate-900 mt-3 mb-1">Section Image (Optional URL)</label>
                    <input
                      type="url"
                      value={b.image_url || ''}
                      onChange={(e) =>
                        setContentBlocks((prev) =>
                          prev.map((x) => (x.id === b.id ? { ...x, image_url: e.target.value } : x))
                        )
                      }
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                      placeholder="https://example.com/illustration.jpg"
                    />

                    <label className="block text-sm font-semibold text-slate-900 mt-3 mb-1">Body Content (HTML supported)</label>
                    <textarea
                      value={b.body_html}
                      onChange={(e) =>
                        setContentBlocks((prev) => prev.map((x) => (x.id === b.id ? { ...x, body_html: e.target.value } : x)))
                      }
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-brand-primary focus:border-transparent font-mono text-sm resize-y"
                      rows={6}
                      placeholder="<p>Write detailed, helpful content here...</p>"
                    />
                  </div>
                ))}
              </div>

              <button
                type="button"
                className="w-full mt-4 border-2 border-dashed border-slate-200 rounded-lg py-2 text-brand-primary hover:bg-blue-50 hover:border-brand-primary transition inline-flex items-center justify-center gap-2"
                onClick={() => setContentBlocks((prev) => [...prev, { id: uid(), heading: '', image_url: '', body_html: '' }])}
              >
                <Plus className="w-4 h-4" />
                Add New Section Block
              </button>
            </div>

            {/* 3. FAQ Section */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 sm:p-5">
              <h2 className="text-sm font-bold tracking-wide uppercase text-slate-900 border-b border-slate-200 pb-2 mb-4">
                3. FAQ Section (Structured Data)
              </h2>

              {faqs.length === 0 ? (
                <div className="text-sm text-slate-600">No FAQ added yet.</div>
              ) : null}

              <div className="space-y-3 mt-3">
                {faqs.map((f, idx) => (
                  <div key={f.id} className="border border-slate-200 rounded-xl bg-white p-4">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-slate-900">Question #{idx + 1}</div>
                      <button
                        type="button"
                        className="text-xs text-red-600 hover:underline inline-flex items-center gap-1"
                        onClick={() => setFaqs((prev) => prev.filter((x) => x.id !== f.id))}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Remove
                      </button>
                    </div>
                    <label className="block text-sm font-semibold text-slate-900 mt-3 mb-1">Question</label>
                    <input
                      type="text"
                      value={f.question}
                      onChange={(e) => setFaqs((prev) => prev.map((x) => (x.id === f.id ? { ...x, question: e.target.value } : x)))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                      placeholder="Enter question..."
                    />
                    <label className="block text-sm font-semibold text-slate-900 mt-3 mb-1">Schema Answer</label>
                    <textarea
                      value={f.answer}
                      onChange={(e) => setFaqs((prev) => prev.map((x) => (x.id === f.id ? { ...x, answer: e.target.value } : x)))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-brand-primary focus:border-transparent resize-y"
                      rows={3}
                      placeholder="Enter answer..."
                    />
                  </div>
                ))}
              </div>

              <button
                type="button"
                className="w-full mt-4 border-2 border-dashed border-slate-200 rounded-lg py-2 text-brand-primary hover:bg-blue-50 hover:border-brand-primary transition inline-flex items-center justify-center gap-2"
                onClick={() => setFaqs((prev) => [...prev, { id: uid(), question: '', answer: '' }])}
              >
                <Plus className="w-4 h-4" />
                Add FAQ Question
              </button>
            </div>

            {/* 4. Local SEO */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 sm:p-5">
              <h2 className="text-sm font-bold tracking-wide uppercase text-slate-900 border-b border-slate-200 pb-2 mb-4">
                4. Local SEO Targeting
              </h2>

              <label className="block text-sm font-semibold text-slate-900 mb-1">Primary City</label>
              <select
                value={primaryCity}
                onChange={(e) => {
                  const c = e.target.value;
                  setPrimaryCity(c);
                  setSelectedAreas([]);
                }}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-brand-primary focus:border-transparent"
              >
                {Object.keys(CITY_MAP).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <label className="block text-sm font-semibold text-slate-900 mt-4 mb-1">Target Neighborhoods/Areas</label>
              <div className="flex flex-wrap gap-2">
                {(CITY_MAP[primaryCity] || []).map((area) => {
                  const active = selectedAreas.includes(area);
                  return (
                    <button
                      key={area}
                      type="button"
                      className={[
                        'px-3 py-1 rounded-md text-xs font-semibold border transition',
                        active
                          ? 'bg-blue-100 text-brand-primary border-blue-200'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50',
                      ].join(' ')}
                      onClick={() =>
                        setSelectedAreas((prev) =>
                          prev.includes(area) ? prev.filter((x) => x !== area) : [...prev, area]
                        )
                      }
                    >
                      {area}
                    </button>
                  );
                })}
              </div>
            </div>
          </main>

          <aside className="space-y-4 lg:space-y-6">
            {/* SEO Settings */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 sm:p-5">
              <h2 className="text-sm font-bold tracking-wide uppercase text-slate-900 border-b border-slate-200 pb-2 mb-4">
                SEO Settings
              </h2>

              <label className="block text-sm font-semibold text-slate-900 mb-1">Meta Title</label>
              <input
                type="text"
                value={(formData.seo_data as any).meta_title}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, seo_data: { ...p.seo_data, meta_title: e.target.value } as any }))
                }
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                placeholder="Best Car Service in Pune | Expert Guide"
              />

              <label className="block text-sm font-semibold text-slate-900 mt-3 mb-1">Meta Description</label>
              <textarea
                value={(formData.seo_data as any).meta_description}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, seo_data: { ...p.seo_data, meta_description: e.target.value } as any }))
                }
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-brand-primary focus:border-transparent resize-y"
                rows={3}
                placeholder="Looking for trusted car service in Pune? Compare prices, packages and expert tips."
                maxLength={160}
              />

              <label className="block text-sm font-semibold text-slate-900 mt-3 mb-1">Focus Keyword</label>
              <input
                type="text"
                value={(formData.seo_data as any).keywords}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, seo_data: { ...p.seo_data, keywords: e.target.value } as any }))
                }
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                placeholder="e.g. car service in pune"
              />

              <label className="block text-sm font-semibold text-slate-900 mt-3 mb-1">Search Intent</label>
              <select
                value={(formData.seo_data as any).search_intent || 'Informational'}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, seo_data: { ...p.seo_data, search_intent: e.target.value } as any }))
                }
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-brand-primary focus:border-transparent"
              >
                <option>Informational</option>
                <option>Commercial/Transactional</option>
                <option>Local / Navigational</option>
              </select>
            </div>

            {/* AI & Schema */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 sm:p-5">
              <h2 className="text-sm font-bold tracking-wide uppercase text-slate-900 border-b border-slate-200 pb-2 mb-4">
                AI & Schema
              </h2>
              {[
                { key: 'schema_blogposting', label: 'Enable BlogPosting Schema' },
                { key: 'schema_faq', label: 'Enable FAQ Schema' },
                { key: 'eligible_ai_overview', label: 'Eligible for AI Overview (SGE)' },
              ].map((x) => (
                <label key={x.key} className="flex items-center gap-2 text-sm text-slate-800 mb-2">
                  <input
                    type="checkbox"
                    checked={Boolean((formData.seo_data as any)[x.key])}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, seo_data: { ...p.seo_data, [x.key]: e.target.checked } as any }))
                    }
                  />
                  {x.label}
                </label>
              ))}
            </div>

            {/* Author & Trust */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 sm:p-5">
              <h2 className="text-sm font-bold tracking-wide uppercase text-slate-900 border-b border-slate-200 pb-2 mb-4">
                Author & Trust
              </h2>
              <label className="block text-sm font-semibold text-slate-900 mb-1">Author Display Name</label>
              <input
                type="text"
                value={(formData.seo_data as any).author_name || ''}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, seo_data: { ...p.seo_data, author_name: e.target.value } as any }))
                }
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-brand-primary focus:border-transparent"
              />
              <label className="block text-sm font-semibold text-slate-900 mt-3 mb-1">Author Expertise Role</label>
              <select
                value={(formData.seo_data as any).author_role || 'Automotive Expert'}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, seo_data: { ...p.seo_data, author_role: e.target.value } as any }))
                }
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-brand-primary focus:border-transparent"
              >
                <option>Automotive Expert</option>
                <option>Technical Manager</option>
              </select>
            </div>

            {/* CTA */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 sm:p-5">
              <h2 className="text-sm font-bold tracking-wide uppercase text-slate-900 border-b border-slate-200 pb-2 mb-4">
                Call To Action (CTA)
              </h2>
              <label className="block text-sm font-semibold text-slate-900 mb-1">Button Text</label>
              <input
                type="text"
                value={(formData.seo_data as any).cta_text || ''}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, seo_data: { ...p.seo_data, cta_text: e.target.value } as any }))
                }
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-brand-primary focus:border-transparent"
              />
              <label className="block text-sm font-semibold text-slate-900 mt-3 mb-1">Target URL</label>
              <input
                type="url"
                value={(formData.seo_data as any).cta_url || ''}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, seo_data: { ...p.seo_data, cta_url: e.target.value } as any }))
                }
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-brand-primary focus:border-transparent"
              />
            </div>

            {/* Tags */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 sm:p-5">
              <h2 className="text-sm font-bold tracking-wide uppercase text-slate-900 border-b border-slate-200 pb-2 mb-4">
                Tags
              </h2>
              <div className="grid grid-cols-1 gap-2 max-h-56 overflow-auto pr-1">
                {tags.map((tag) => (
                  <label key={tag.id} className="flex items-center gap-2 text-sm text-slate-800">
                    <input
                      type="checkbox"
                      checked={formData.tag_ids.includes(tag.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({ ...formData, tag_ids: [...formData.tag_ids, tag.id] });
                        } else {
                          setFormData({ ...formData, tag_ids: formData.tag_ids.filter((id) => id !== tag.id) });
                        }
                      }}
                    />
                    <span className="truncate">{tag.name}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Publishing */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 sm:p-5">
              <h2 className="text-sm font-bold tracking-wide uppercase text-slate-900 border-b border-slate-200 pb-2 mb-4">
                Publishing
              </h2>
              <label className="block text-sm font-semibold text-slate-900 mb-1">Post Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData((p) => ({ ...p, status: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-brand-primary focus:border-transparent"
              >
                <option value="draft">Draft</option>
                <option value="pending_review">Pending Review</option>
                <option value="published">Published</option>
              </select>

              <div className="flex items-center gap-6 mt-4">
                <label className="flex items-center gap-2 text-sm text-slate-800">
                  <input
                    type="checkbox"
                    checked={Boolean((formData.seo_data as any).robots_index)}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, seo_data: { ...p.seo_data, robots_index: e.target.checked } as any }))
                    }
                  />
                  Index
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-800">
                  <input
                    type="checkbox"
                    checked={Boolean((formData.seo_data as any).robots_follow)}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, seo_data: { ...p.seo_data, robots_follow: e.target.checked } as any }))
                    }
                  />
                  Follow
                </label>
              </div>
            </div>

            {/* Read time */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 sm:p-5">
              <h2 className="text-sm font-bold tracking-wide uppercase text-slate-900 border-b border-slate-200 pb-2 mb-4">
                Reading
              </h2>
              <label className="block text-sm font-semibold text-slate-900 mb-1">Read Time (minutes)</label>
              <input
                type="number"
                value={formData.read_time}
                onChange={(e) => setFormData({ ...formData, read_time: Number.parseInt(e.target.value || '3', 10) || 3 })}
                min={1}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-brand-primary focus:border-transparent"
              />
            </div>
          </aside>
        </div>

        {/* Preview Modal */}
        {showPreview && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <div className="font-semibold text-slate-900">Preview</div>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowPreview(false)}>
                  Close
                </button>
              </div>
              <div className="p-4 overflow-auto max-h-[90vh]">
                {formData.featured_image ? (
                  <img src={formData.featured_image} alt="Featured" className="w-full max-h-80 object-cover rounded-lg mb-4" />
                ) : null}
                <h1 className="text-2xl font-bold text-slate-900 mb-2">{formData.title || 'Untitled'}</h1>
                {formData.excerpt ? <p className="text-slate-700 mb-6">{formData.excerpt}</p> : null}
                <div
                  className="prose prose-slate max-w-none"
                  // eslint-disable-next-line react/no-danger
                  dangerouslySetInnerHTML={{ __html: generatedHtml || '<p>No content yet.</p>' }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
