'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import DashboardLayout from '@/components/DashboardLayout';
import RichTextEditor from '@/components/blog/RichTextEditor';
import LimitHint from '@/components/blog/LimitHint';
import { ArrowLeft, Eye, Save, Sparkles, UploadCloud } from 'lucide-react';
import { extractKeywordsFromSummary } from '@/lib/blog/seo';
import { collectHeadingWordWarnings, stripHtmlToText } from '@/lib/blog/text';

type Category = { id: string; name: string };
type Tag = { id: string; name: string };
type FaqItem = { id: string; question: string; answer: string };

function uid() {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

export default function DigitalAuthorEditBlogPage() {
  const router = useRouter();
  const params = useParams();
  const blogId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingFeatured, setUploadingFeatured] = useState(false);
  const [generatingFaqs, setGeneratingFaqs] = useState(false);
  const [autoTagging, setAutoTagging] = useState(false);
  const [generatingLocalKeywords, setGeneratingLocalKeywords] = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [customLocalArea, setCustomLocalArea] = useState('');

  const [formData, setFormData] = useState<any>({
    title: '',
    slug: '',
    excerpt: '',
    content: '',
    category_id: '',
    category_ids: [] as string[],
    featured_image: '',
    status: 'draft',
    tag_ids: [] as string[],
    seo_data: {
      meta_title: '',
      meta_description: '',
      keywords: '',
      canonical_url: '',
      og_title: '',
      og_description: '',
      og_image: '',
      featured_image_alt: '',
      schema_blogposting: true,
      schema_faq: true,
      eligible_ai_overview: true,
      author_name: 'MyFNG Auto Expert Team',
      author_role: 'Automotive Expert',
      search_intent: 'Informational',
      local_city: '',
      local_areas: [],
    },
  });

  const canGenerateAi = useMemo(() => {
    return String(formData.title || '').trim().length >= 6 && String(formData.content || '').trim().length >= 50;
  }, [formData.title, formData.content]);

  const wordText = useMemo(() => stripHtmlToText(String(formData.content || '')), [formData.content]);
  const headingWarnings = useMemo(() => collectHeadingWordWarnings(String(formData.content || ''), 10), [formData.content]);
  const selectedTagWordViolations = useMemo(() => {
    const selected = new Set<string>((formData.tag_ids || []) as string[]);
    const chosen = tags.filter((t) => selected.has(t.id)).map((t) => t.name);
    const bad = chosen.filter((name) => String(name || '').trim().split(/\s+/).filter(Boolean).length > 3);
    return bad;
  }, [formData.tag_ids, tags]);

  // Auto-fill meta description + keywords from AI Summary if empty (real-time)
  useEffect(() => {
    const summary = String(formData.excerpt || '').trim();
    if (!summary) return;
    setFormData((p: any) => {
      const metaDesc = String(p.seo_data?.meta_description || '').trim();
      const kw = String(p.seo_data?.keywords || '').trim();
      const next: any = { ...p, seo_data: { ...(p.seo_data || {}) } };
      if (!metaDesc) next.seo_data.meta_description = summary.slice(0, 155);
      if (!kw) next.seo_data.keywords = extractKeywordsFromSummary(summary, 10);
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.excerpt]);

  useEffect(() => {
    if (!blogId) return;
    fetchBlog();
    fetchCategories();
    fetchTags();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blogId]);

  async function fetchBlog() {
    setLoading(true);
    try {
      const res = await fetch(`/api/blogs/${blogId}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to load blog');
      const b = data?.blog;

      const cats: string[] = Array.isArray(b?.categories) ? b.categories.map((c: any) => c?.id).filter(Boolean) : [];
      const effectiveCats = cats.length ? cats : b?.category_id ? [b.category_id] : [];

      setFaqs(
        (Array.isArray(b?.faqs) ? b.faqs : []).map((f: any) => ({
          id: uid(),
          question: String(f?.question || ''),
          answer: String(f?.answer || ''),
        }))
      );

      setFormData({
        title: b?.title || '',
        slug: b?.slug || '',
        excerpt: b?.excerpt || '',
        content: b?.content || '',
        category_id: effectiveCats[0] || '',
        category_ids: effectiveCats,
        featured_image: b?.featured_image || '',
        status: b?.status || 'draft',
        tag_ids: (Array.isArray(b?.tags) ? b.tags : []).map((t: any) => t?.id).filter(Boolean),
        seo_data: {
          ...(b?.seo_data || {}),
          featured_image_alt: String(b?.seo_data?.featured_image_alt || ''),
          schema_blogposting: b?.seo_data?.schema_blogposting ?? true,
          schema_faq: b?.seo_data?.schema_faq ?? true,
          eligible_ai_overview: b?.seo_data?.eligible_ai_overview ?? true,
        },
      });
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load blog');
      router.push('/dashboard/digital_author/blogs');
    } finally {
      setLoading(false);
    }
  }

  async function fetchCategories() {
    try {
      const res = await fetch('/api/blogs/categories');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return;
      setCategories((data?.categories || []) as Category[]);
    } catch {
      // ignore
    }
  }

  async function fetchTags() {
    try {
      const res = await fetch('/api/blogs/tags');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return;
      setTags((data?.tags || []) as Tag[]);
    } catch {
      // ignore
    }
  }

  async function uploadFeaturedImage(file: File) {
    const slug = String(formData.slug || '').trim();
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
      setFormData((p: any) => ({ ...p, featured_image: url, seo_data: { ...p.seo_data, og_image: p.seo_data.og_image || url } }));
      const warn = String(data?.info?.aspect_ratio_warning || '');
      if (warn) toast(warn);
      toast.success('Featured image uploaded');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to upload image');
    } finally {
      setUploadingFeatured(false);
    }
  }

  async function generateFaqsWithAi() {
    if (!canGenerateAi) {
      toast.error('Please enter Title + enough content first.');
      return;
    }
    try {
      setGeneratingFaqs(true);
      const res = await fetch('/api/blogs/ai-faqs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: String(formData.title || '').trim(),
          content: String(formData.content || '').trim(),
          focusKeyword: String(formData.seo_data?.keywords || '').trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to generate FAQs');
      const items = Array.isArray(data?.faqs) ? data.faqs : [];
      setFaqs(items.slice(0, 8).map((f: any) => ({ id: uid(), question: String(f.question || ''), answer: String(f.answer || '') })));
      toast.success('FAQs generated (editable)');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to generate FAQs');
    } finally {
      setGeneratingFaqs(false);
    }
  }

  async function autoTagWithAi() {
    if (!canGenerateAi) {
      toast.error('Please enter Title + enough content first.');
      return;
    }
    try {
      setAutoTagging(true);
      const res = await fetch('/api/blogs/ai-auto-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: String(formData.title || '').trim(),
          content: String(formData.content || '').trim(),
          focusKeyword: String(formData.seo_data?.keywords || '').trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to auto-tag');
      const ids: string[] = Array.isArray(data?.tag_ids) ? data.tag_ids : [];
      setFormData((p: any) => ({ ...p, tag_ids: Array.from(new Set([...(p.tag_ids || []), ...ids])) }));
      toast.success('Tags updated');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to auto-tag');
    } finally {
      setAutoTagging(false);
    }
  }

  async function generateLocalSeoKeywords() {
    const location = customLocalArea.trim();
    if (!location) {
      toast.error('Enter a specific area (e.g. "Vartak Nagar, Thane West").');
      return;
    }
    if (!String(formData.title || '').trim()) {
      toast.error('Please enter a Title first.');
      return;
    }
    try {
      setGeneratingLocalKeywords(true);
      const res = await fetch('/api/blogs/ai-local-seo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location,
          title: String(formData.title || '').trim(),
          focusKeyword: String(formData.seo_data?.keywords || '').trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to generate local keywords');
      const locals: string[] = Array.isArray(data?.local_keywords) ? data.local_keywords : [];
      setFormData((p: any) => {
        const existing = String(p.seo_data?.keywords || '')
          .split(',')
          .map((x: string) => x.trim())
          .filter(Boolean);
        const merged = Array.from(new Set([...existing, ...locals])).slice(0, 25);
        return { ...p, seo_data: { ...p.seo_data, keywords: merged.join(', ') } };
      });
      toast.success('Local SEO keywords added');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to generate local keywords');
    } finally {
      setGeneratingLocalKeywords(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (formData.featured_image && !String(formData.seo_data?.featured_image_alt || '').trim()) {
      toast.error('Featured image ALT text is required.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...formData,
        faqs: faqs
          .filter((f) => (f.question || '').trim() && (f.answer || '').trim())
          .map((f) => ({ question: String(f.question).trim(), answer: String(f.answer).trim() })),
      };
      const res = await fetch(`/api/blogs/${blogId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to update blog');
      if (Array.isArray(data?.warnings) && data.warnings.length) toast(data.warnings[0]);
      toast.success('Blog updated');
      await fetchBlog();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update blog');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <DashboardLayout role="digital_author">
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
    <DashboardLayout role="digital_author">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/digital_author/blogs">
              <button type="button" className="btn btn-outline btn-sm">
                <ArrowLeft className="w-4 h-4" />
              </button>
            </Link>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-text-heading">Edit Blog</h1>
              <p className="text-text-body mt-1">Doc-compliant editor (TinyMCE + SEO + AI)</p>
            </div>
          </div>
          <Link href={`/dashboard/digital_author/blogs/${blogId}`}>
            <button type="button" className="btn btn-outline btn-sm inline-flex items-center gap-2">
              <Eye className="w-4 h-4" />
              View
            </button>
          </Link>
        </div>

        <form onSubmit={save} className="space-y-6">
          <div className="card space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-heading mb-1">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData((p: any) => ({ ...p, title: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                  required
                />
                <LimitHint value={formData.title} mode="chars" recommended={{ min: 50, max: 60 }} />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-heading mb-1">
                  Slug <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) => setFormData((p: any) => ({ ...p, slug: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-heading mb-1">AI Summary (Takeaways)</label>
              <textarea
                value={formData.excerpt}
                onChange={(e) => setFormData((p: any) => ({ ...p, excerpt: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                rows={3}
                placeholder="Max 60 words recommended"
              />
              <LimitHint value={formData.excerpt} mode="words" recommended={{ max: 60 }} />
            </div>

            <div>
              <div className="flex items-center justify-between gap-3 mb-2">
                <label className="block text-sm font-medium text-text-heading">
                  Content <span className="text-red-500">*</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn btn-outline btn-sm" onClick={generateFaqsWithAi} disabled={generatingFaqs || !canGenerateAi}>
                    <Sparkles className="w-4 h-4" /> {generatingFaqs ? 'Generating...' : 'AI FAQs'}
                  </button>
                  <button type="button" className="btn btn-outline btn-sm" onClick={autoTagWithAi} disabled={autoTagging || !canGenerateAi}>
                    <Sparkles className="w-4 h-4" /> {autoTagging ? 'Auto-tagging...' : 'Auto-Tag'}
                  </button>
                </div>
              </div>
              <div className="bg-white border border-gray-300 rounded-lg overflow-hidden">
                <RichTextEditor
                  slug={String(formData.slug || '').trim() || 'draft'}
                  value={formData.content}
                  onChange={(html) => setFormData((p: any) => ({ ...p, content: html }))}
                  disabled={saving}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Every inserted image must have ALT text (save/publish blocked if missing).</p>
              <LimitHint value={wordText} mode="words" label="Word count" recommended={{ min: 800 }} />
              {headingWarnings.length ? (
                <div className="text-[11px] text-amber-700 mt-1">
                  {headingWarnings.slice(0, 3).map((w) => (
                    <div key={w}>• {w}</div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-4">
              <div className="card">
                <h2 className="text-base font-semibold text-text-heading mb-3">SEO Settings</h2>
                <label className="block text-sm font-medium text-text-heading mb-1">Meta Title</label>
                <input
                  type="text"
                  value={String(formData.seo_data?.meta_title || '')}
                  onChange={(e) => setFormData((p: any) => ({ ...p, seo_data: { ...p.seo_data, meta_title: e.target.value } }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />

                <label className="block text-sm font-medium text-text-heading mt-3 mb-1">Meta Description</label>
                <textarea
                  value={String(formData.seo_data?.meta_description || '')}
                  onChange={(e) => setFormData((p: any) => ({ ...p, seo_data: { ...p.seo_data, meta_description: e.target.value } }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows={3}
                />
                <LimitHint value={String(formData.seo_data?.meta_description || '')} mode="chars" recommended={{ min: 120, max: 155 }} />

                <label className="block text-sm font-medium text-text-heading mt-3 mb-1">Meta Keywords</label>
                <input
                  type="text"
                  value={String(formData.seo_data?.keywords || '')}
                  onChange={(e) => setFormData((p: any) => ({ ...p, seo_data: { ...p.seo_data, keywords: e.target.value } }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div className="card">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-base font-semibold text-text-heading">FAQs (Editable)</h2>
                  <button type="button" className="btn btn-outline btn-sm" onClick={generateFaqsWithAi} disabled={generatingFaqs || !canGenerateAi}>
                    <Sparkles className="w-4 h-4" /> {generatingFaqs ? 'Generating...' : 'Generate'}
                  </button>
                </div>
                <div className="space-y-3 mt-3">
                  {faqs.map((f) => (
                    <div key={f.id} className="border border-gray-200 rounded-lg p-3">
                      <input
                        type="text"
                        value={f.question}
                        onChange={(e) => setFaqs((prev) => prev.map((x) => (x.id === f.id ? { ...x, question: e.target.value } : x)))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                        placeholder="Question"
                      />
                      <textarea
                        value={f.answer}
                        onChange={(e) => setFaqs((prev) => prev.map((x) => (x.id === f.id ? { ...x, answer: e.target.value } : x)))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg mt-2"
                        rows={3}
                        placeholder="Answer"
                      />
                      <div className="mt-2">
                        <button type="button" className="text-xs text-red-600 hover:underline" onClick={() => setFaqs((prev) => prev.filter((x) => x.id !== f.id))}>
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => setFaqs((p) => [...p, { id: uid(), question: '', answer: '' }])}>
                    Add FAQ
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="card">
                <h2 className="text-base font-semibold text-text-heading mb-3">Featured Image (1980×1080, .webp, ≤200KB)</h2>
                <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center relative">
                  <UploadCloud className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                  <div className="text-sm text-gray-600">{uploadingFeatured ? 'Uploading...' : 'Upload featured image'}</div>
                  <input
                    type="file"
                    accept="image/*"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    disabled={uploadingFeatured || saving}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      uploadFeaturedImage(f);
                      e.currentTarget.value = '';
                    }}
                  />
                </div>

                <label className="block text-sm font-medium text-text-heading mt-3 mb-1">Featured Image URL</label>
                <input
                  type="url"
                  value={formData.featured_image}
                  onChange={(e) => setFormData((p: any) => ({ ...p, featured_image: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />

                <label className="block text-sm font-medium text-text-heading mt-3 mb-1">
                  Featured Image ALT <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={String(formData.seo_data?.featured_image_alt || '')}
                  onChange={(e) => setFormData((p: any) => ({ ...p, seo_data: { ...p.seo_data, featured_image_alt: e.target.value } }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  maxLength={125}
                />
                <LimitHint value={String(formData.seo_data?.featured_image_alt || '')} mode="chars" recommended={{ max: 125 }} hardMax={125} />
              </div>

              <div className="card">
                <h2 className="text-base font-semibold text-text-heading mb-3">Categories (Multi)</h2>
                <label className="block text-sm font-medium text-text-heading mb-1">Primary Category</label>
                <select
                  value={formData.category_ids?.[0] || formData.category_id || ''}
                  onChange={(e) => {
                    const primary = e.target.value;
                    setFormData((p: any) => {
                      const rest = (p.category_ids || []).filter((id: string) => id !== primary);
                      const nextIds = primary ? [primary, ...rest] : rest;
                      return { ...p, category_id: primary, category_ids: nextIds };
                    });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
                >
                  <option value="">Select category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>

                <div className="mt-3 grid grid-cols-1 gap-2 max-h-44 overflow-auto pr-1">
                  {categories.map((c) => (
                    <label key={c.id} className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={(formData.category_ids || []).includes(c.id)}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setFormData((p: any) => {
                            const current = p.category_ids || [];
                            if (checked) {
                              const next = Array.from(new Set([...(current.length ? current : p.category_id ? [p.category_id] : []), c.id]));
                              return { ...p, category_id: next[0] || '', category_ids: next };
                            }
                            const next = current.filter((id: string) => id !== c.id);
                            return { ...p, category_id: next[0] || '', category_ids: next };
                          });
                        }}
                      />
                      <span className="truncate">{c.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="card">
                <h2 className="text-base font-semibold text-text-heading mb-3">Tags</h2>
                <button type="button" className="btn btn-outline btn-sm w-full mb-3" onClick={autoTagWithAi} disabled={autoTagging || !canGenerateAi}>
                  <Sparkles className="w-4 h-4" /> {autoTagging ? 'Auto-tagging...' : 'Auto-Tag (AI)'}
                </button>
                <LimitHint
                  value=""
                  mode="chars"
                  label="Tags selected"
                  countOverride={(formData.tag_ids || []).length}
                  unitOverride="tags"
                  recommended={{ min: 5, max: 10 }}
                />
                <div className="text-[11px] text-slate-500 -mt-0.5">
                  Each tag should be 1–3 words.
                  {selectedTagWordViolations.length ? (
                    <span className="text-amber-700"> ({selectedTagWordViolations.slice(0, 2).join(', ')}{selectedTagWordViolations.length > 2 ? '…' : ''} too long)</span>
                  ) : null}
                </div>
                <div className="grid grid-cols-1 gap-2 max-h-56 overflow-auto pr-1">
                  {tags.map((t) => (
                    <label key={t.id} className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={(formData.tag_ids || []).includes(t.id)}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setFormData((p: any) => ({
                            ...p,
                            tag_ids: checked ? [...(p.tag_ids || []), t.id] : (p.tag_ids || []).filter((id: string) => id !== t.id),
                          }));
                        }}
                      />
                      <span className="truncate">{t.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="card">
                <h2 className="text-base font-semibold text-text-heading mb-3">Local SEO</h2>
                <div className="flex flex-col gap-2">
                  <input
                    type="text"
                    value={customLocalArea}
                    onChange={(e) => setCustomLocalArea(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder='e.g. "Vartak Nagar, Thane West"'
                  />
                  <button type="button" className="btn btn-outline btn-sm" onClick={generateLocalSeoKeywords} disabled={generatingLocalKeywords}>
                    {generatingLocalKeywords ? 'Generating...' : 'Generate local keywords'}
                  </button>
                </div>
              </div>

              <div className="card">
                <h2 className="text-base font-semibold text-text-heading mb-3">AI & Schema Toggles</h2>
                {[
                  { key: 'schema_blogposting', label: 'Enable BlogPosting Schema' },
                  { key: 'schema_faq', label: 'Enable FAQ Schema' },
                  { key: 'eligible_ai_overview', label: 'Eligible for AI Overview (SGE)' },
                ].map((x) => (
                  <label key={x.key} className="flex items-center gap-2 text-sm text-gray-700 mb-2">
                    <input
                      type="checkbox"
                      checked={Boolean(formData.seo_data?.[x.key])}
                      onChange={(e) => setFormData((p: any) => ({ ...p, seo_data: { ...p.seo_data, [x.key]: e.target.checked } }))}
                    />
                    {x.label}
                  </label>
                ))}
              </div>

              <div className="card">
                <h2 className="text-base font-semibold text-text-heading mb-3">Publishing</h2>
                <label className="block text-sm font-medium text-text-heading mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData((p: any) => ({ ...p, status: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
                >
                  <option value="draft">Draft</option>
                  <option value="pending_review">Pending Review</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button type="submit" className="btn btn-primary inline-flex items-center gap-2" disabled={saving}>
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}


