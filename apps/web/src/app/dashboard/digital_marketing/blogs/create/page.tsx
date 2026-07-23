'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import DashboardLayout from '@/components/DashboardLayout';
import RichTextEditor from '@/components/blog/RichTextEditor';
import LimitHint from '@/components/blog/LimitHint';
import { BLOG_INPUT, BLOG_TEXTAREA, BlogChecklistItem, BlogSectionCard } from '@/components/blog/BlogEditorUi';
import { ArrowLeft, FileText, Globe, Image as ImageIcon, Save, Sparkles, Tag, UploadCloud } from 'lucide-react';
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

export default function DigitalMarketingCreateBlogPage() {
  const router = useRouter();

  const [saving, setSaving] = useState(false);
  const [uploadingFeatured, setUploadingFeatured] = useState(false);
  const [generatingFaqs, setGeneratingFaqs] = useState(false);
  const [autoTagging, setAutoTagging] = useState(false);
  const [generatingLocalKeywords, setGeneratingLocalKeywords] = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [authors, setAuthors] = useState<Array<{ id: string; full_name: string }>>([]);
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
    is_featured: false,
    is_premium: false,
    tag_ids: [] as string[],
    author_id: '',
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
      robots_index: true,
      robots_follow: true,
    },
  });

  useEffect(() => {
    fetchCategories();
    fetchTags();
    fetchAuthors();
  }, []);

  async function fetchAuthors() {
    try {
      const res = await fetch('/api/blogs/authors');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return;
      const list = (data?.authors || []) as Array<{ id: string; full_name: string }>;
      setAuthors(list);
      if (list[0]?.id) {
        setFormData((p: any) => ({ ...p, author_id: p.author_id || list[0].id }));
      }
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    if (!formData.title) return;
    const slug = String(formData.title || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    setFormData((p: any) => ({ ...p, slug }));
  }, [formData.title]);

  useEffect(() => {
    const summary = String(formData.excerpt || '').trim();
    const title = String(formData.title || '').trim();
    if (!summary && !title) return;
    setFormData((p: any) => {
      const next = { ...p, seo_data: { ...p.seo_data } };
      if (summary && !String(next.seo_data.meta_description || '').trim()) {
        next.seo_data.meta_description = summary.slice(0, 155);
      }
      if (title && !String(next.seo_data.meta_title || '').trim()) {
        next.seo_data.meta_title = title.slice(0, 60);
      }
      if (title && !String(next.seo_data.og_title || '').trim()) {
        next.seo_data.og_title = title.slice(0, 60);
      }
      if (summary && !String(next.seo_data.og_description || '').trim()) {
        next.seo_data.og_description = summary.slice(0, 155);
      }
      return next;
    });
  }, [formData.excerpt, formData.title]);

  useEffect(() => {
    const summary = String(formData.excerpt || '').trim();
    const current = String(formData.seo_data?.keywords || '').trim();
    if (!summary || current) return;
    const kw = extractKeywordsFromSummary(summary, 10);
    if (!kw) return;
    setFormData((p: any) => ({ ...p, seo_data: { ...p.seo_data, keywords: kw } }));
  }, [formData.excerpt, formData.seo_data?.keywords]);

  const canGenerateAi = useMemo(() => {
    return String(formData.title || '').trim().length >= 6 && String(formData.content || '').trim().length >= 50;
  }, [formData.title, formData.content]);

  const wordText = useMemo(() => stripHtmlToText(String(formData.content || '')), [formData.content]);
  const wordCount = useMemo(() => wordText.split(/\s+/).filter(Boolean).length, [wordText]);
  const headingWarnings = useMemo(() => collectHeadingWordWarnings(String(formData.content || ''), 10), [formData.content]);
  const selectedTagWordViolations = useMemo(() => {
    const selected = new Set<string>((formData.tag_ids || []) as string[]);
    const chosen = tags.filter((t) => selected.has(t.id)).map((t) => t.name);
    return chosen.filter((name) => String(name || '').trim().split(/\s+/).filter(Boolean).length > 3);
  }, [formData.tag_ids, tags]);

  const checklist = useMemo(
    () => ({
      title: Boolean(String(formData.title || '').trim()),
      slug: Boolean(String(formData.slug || '').trim()),
      content: wordCount >= 50,
      excerpt: Boolean(String(formData.excerpt || '').trim()),
      category: Boolean(formData.category_id || (formData.category_ids || []).length),
      featured: Boolean(String(formData.featured_image || '').trim()),
      featuredAlt: Boolean(String(formData.seo_data?.featured_image_alt || '').trim()),
      metaDesc: Boolean(String(formData.seo_data?.meta_description || '').trim()),
      tags: (formData.tag_ids || []).length >= 3,
    }),
    [formData, wordCount],
  );

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
      setFormData((p: any) => ({
        ...p,
        featured_image: url,
        seo_data: { ...p.seo_data, og_image: p.seo_data.og_image || url },
      }));
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

  async function submit(statusOverride?: 'draft' | 'pending_review' | 'published') {
    if (formData.featured_image && !String(formData.seo_data?.featured_image_alt || '').trim()) {
      toast.error('Featured image ALT text is required.');
      return;
    }
    if (!formData.title || !formData.slug || !formData.content) {
      toast.error('Please fill Title + Slug + Content');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...formData,
        status: statusOverride || formData.status,
        faqs: faqs
          .filter((f) => (f.question || '').trim() && (f.answer || '').trim())
          .map((f) => ({ question: String(f.question).trim(), answer: String(f.answer).trim() })),
      };
      const res = await fetch('/api/blogs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to create blog');
      if (Array.isArray(data?.warnings) && data.warnings.length) toast(data.warnings[0]);
      toast.success('Blog created');
      router.push(`/dashboard/digital_marketing/blogs/${data.blog.id}/edit`);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to create blog');
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardLayout role="digital_marketing">
      <div className="space-y-5 pb-10">
        {/* Header */}
        <div className="sticky top-0 z-20 -mx-1 px-1 py-3 bg-[#F5F7FA]/95 backdrop-blur border-b border-gray-200/80">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <Link href="/dashboard/digital_marketing/blogs">
                <button type="button" className="btn btn-outline btn-sm shrink-0">
                  <ArrowLeft className="w-4 h-4" />
                </button>
              </Link>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold text-text-heading truncate">Create Blog</h1>
                <p className="text-xs sm:text-sm text-text-body mt-0.5">
                  Rich editor · SEO · Categories · Featured image · AI assist
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <Link href="/dashboard/digital_marketing/blogs/ai-create">
                <button type="button" className="btn btn-outline btn-sm inline-flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" /> AI Draft
                </button>
              </Link>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => submit('draft')} disabled={saving}>
                Save Draft
              </button>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => submit('pending_review')} disabled={saving}>
                Send for Review
              </button>
              <button type="button" className="btn btn-primary btn-sm inline-flex items-center gap-1.5" onClick={() => submit('published')} disabled={saving}>
                <Save className="w-4 h-4" /> Publish
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-5 items-start">
          {/* ── Main column ── */}
          <div className="space-y-5 min-w-0">
            <BlogSectionCard
              title="Basic details"
              description="Title, URL slug, and short summary shown on listing cards."
              icon={<FileText className="w-4 h-4" />}
            >
              <div className="space-y-4">
                <div>
                  <label className="label">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData((p: any) => ({ ...p, title: e.target.value }))}
                    className={BLOG_INPUT}
                    placeholder="e.g. How Monsoon Traffic Affects Your Car in Navi Mumbai"
                  />
                  <LimitHint value={formData.title} mode="chars" recommended={{ min: 50, max: 60 }} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">
                      Slug <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.slug}
                      onChange={(e) => setFormData((p: any) => ({ ...p, slug: e.target.value }))}
                      className={BLOG_INPUT}
                      placeholder="url-friendly-slug"
                    />
                  </div>
                  <div>
                    <label className="label">Public URL preview</label>
                    <div className="px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-xs text-gray-600 break-all">
                      {formData.slug ? (
                        <>
                          <Globe className="w-3.5 h-3.5 inline mr-1 text-brand-primary" />
                          myfng.in/blogs/{formData.slug}
                        </>
                      ) : (
                        'Slug will appear here'
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="label">AI Summary (Takeaways)</label>
                  <textarea
                    value={formData.excerpt}
                    onChange={(e) => setFormData((p: any) => ({ ...p, excerpt: e.target.value }))}
                    className={BLOG_TEXTAREA}
                    rows={3}
                    placeholder="Short summary for cards & meta description (max ~60 words)"
                  />
                  <LimitHint value={formData.excerpt} mode="words" recommended={{ max: 60 }} />
                </div>
              </div>
            </BlogSectionCard>

            <BlogSectionCard
              title="Blog content"
              description="Use headings (H2/H3), bullet lists, and images with ALT text."
              icon={<FileText className="w-4 h-4" />}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <p className="text-xs text-gray-500">Required · min ~800 words recommended for SEO</p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn btn-outline btn-sm" onClick={generateFaqsWithAi} disabled={generatingFaqs || !canGenerateAi}>
                    <Sparkles className="w-4 h-4" /> {generatingFaqs ? 'Generating…' : 'AI FAQs'}
                  </button>
                  <button type="button" className="btn btn-outline btn-sm" onClick={autoTagWithAi} disabled={autoTagging || !canGenerateAi}>
                    <Sparkles className="w-4 h-4" /> {autoTagging ? 'Tagging…' : 'Auto-Tag'}
                  </button>
                </div>
              </div>
              <div className="bg-white border border-gray-300 rounded-lg overflow-hidden min-h-[420px]">
                <RichTextEditor
                  slug={String(formData.slug || '').trim() || 'draft'}
                  value={formData.content}
                  onChange={(html) => setFormData((p: any) => ({ ...p, content: html }))}
                  disabled={saving}
                />
              </div>
              <p className="text-xs text-gray-500 mt-2">Every image must have ALT text before publish.</p>
              <LimitHint value={wordText} mode="words" label="Word count" recommended={{ min: 800 }} />
              {headingWarnings.length ? (
                <div className="text-[11px] text-amber-700 mt-1 space-y-0.5">
                  {headingWarnings.slice(0, 3).map((w, idx) => (
                    <div key={`${w}-${idx}`}>• {w}</div>
                  ))}
                </div>
              ) : null}
            </BlogSectionCard>

            <BlogSectionCard
              title="SEO settings"
              description="Auto-filled from title & summary — edit as needed."
              icon={<Globe className="w-4 h-4" />}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="label">Meta Title</label>
                  <input
                    type="text"
                    value={String(formData.seo_data?.meta_title || '')}
                    onChange={(e) => setFormData((p: any) => ({ ...p, seo_data: { ...p.seo_data, meta_title: e.target.value } }))}
                    className={BLOG_INPUT}
                  />
                  <LimitHint value={String(formData.seo_data?.meta_title || '')} mode="chars" recommended={{ min: 50, max: 60 }} />
                </div>
                <div className="md:col-span-2">
                  <label className="label">Meta Description</label>
                  <textarea
                    value={String(formData.seo_data?.meta_description || '')}
                    onChange={(e) =>
                      setFormData((p: any) => ({ ...p, seo_data: { ...p.seo_data, meta_description: e.target.value } }))
                    }
                    className={BLOG_TEXTAREA}
                    rows={3}
                  />
                  <LimitHint value={String(formData.seo_data?.meta_description || '')} mode="chars" recommended={{ min: 120, max: 155 }} />
                </div>
                <div className="md:col-span-2">
                  <label className="label">Meta Keywords</label>
                  <input
                    type="text"
                    value={String(formData.seo_data?.keywords || '')}
                    onChange={(e) => setFormData((p: any) => ({ ...p, seo_data: { ...p.seo_data, keywords: e.target.value } }))}
                    className={BLOG_INPUT}
                    placeholder="comma, separated, keywords"
                  />
                </div>
                <div>
                  <label className="label">OG Title</label>
                  <input
                    type="text"
                    value={String(formData.seo_data?.og_title || '')}
                    onChange={(e) => setFormData((p: any) => ({ ...p, seo_data: { ...p.seo_data, og_title: e.target.value } }))}
                    className={BLOG_INPUT}
                  />
                </div>
                <div>
                  <label className="label">Search Intent</label>
                  <select
                    value={String(formData.seo_data?.search_intent || 'Informational')}
                    onChange={(e) => setFormData((p: any) => ({ ...p, seo_data: { ...p.seo_data, search_intent: e.target.value } }))}
                    className={BLOG_INPUT}
                  >
                    <option value="Informational">Informational</option>
                    <option value="Commercial">Commercial</option>
                    <option value="Transactional">Transactional</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="label">OG Description</label>
                  <textarea
                    value={String(formData.seo_data?.og_description || '')}
                    onChange={(e) =>
                      setFormData((p: any) => ({ ...p, seo_data: { ...p.seo_data, og_description: e.target.value } }))
                    }
                    className={BLOG_TEXTAREA}
                    rows={2}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="label">Canonical URL (optional)</label>
                  <input
                    type="url"
                    value={String(formData.seo_data?.canonical_url || '')}
                    onChange={(e) => setFormData((p: any) => ({ ...p, seo_data: { ...p.seo_data, canonical_url: e.target.value } }))}
                    className={BLOG_INPUT}
                    placeholder="https://myfng.in/blogs/your-slug"
                  />
                </div>
              </div>
            </BlogSectionCard>

            <BlogSectionCard title="FAQs" description="Optional — improves FAQ schema on public blog page.">
              <div className="flex items-center justify-between gap-3 mb-3">
                <p className="text-xs text-gray-500">{faqs.length} FAQ(s)</p>
                <button type="button" className="btn btn-outline btn-sm" onClick={generateFaqsWithAi} disabled={generatingFaqs || !canGenerateAi}>
                  <Sparkles className="w-4 h-4" /> Generate with AI
                </button>
              </div>
              <div className="space-y-3">
                {faqs.map((f) => (
                  <div key={f.id} className="border border-gray-200 rounded-lg p-3 bg-gray-50/50">
                    <input
                      type="text"
                      value={f.question}
                      onChange={(e) => setFaqs((prev) => prev.map((x) => (x.id === f.id ? { ...x, question: e.target.value } : x)))}
                      className={BLOG_INPUT}
                      placeholder="Question"
                    />
                    <textarea
                      value={f.answer}
                      onChange={(e) => setFaqs((prev) => prev.map((x) => (x.id === f.id ? { ...x, answer: e.target.value } : x)))}
                      className={`${BLOG_TEXTAREA} mt-2`}
                      rows={3}
                      placeholder="Answer"
                    />
                    <button
                      type="button"
                      className="text-xs text-red-600 hover:underline mt-2"
                      onClick={() => setFaqs((prev) => prev.filter((x) => x.id !== f.id))}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setFaqs((p) => [...p, { id: uid(), question: '', answer: '' }])}>
                  + Add FAQ
                </button>
              </div>
            </BlogSectionCard>
          </div>

          {/* ── Sidebar ── */}
          <aside className="space-y-4 xl:sticky xl:top-[88px]">
            <BlogSectionCard title="Publish checklist" className="!p-4">
              <div className="space-y-2">
                <BlogChecklistItem done={checklist.title} label="Title added" />
                <BlogChecklistItem done={checklist.slug} label="Slug set" />
                <BlogChecklistItem done={checklist.content} label="Content (50+ words)" />
                <BlogChecklistItem done={checklist.excerpt} label="Summary / excerpt" />
                <BlogChecklistItem done={checklist.category} label="Category selected" />
                <BlogChecklistItem done={checklist.featured} label="Featured image" />
                <BlogChecklistItem done={checklist.featuredAlt} label="Featured image ALT" />
                <BlogChecklistItem done={checklist.metaDesc} label="Meta description" />
                <BlogChecklistItem done={checklist.tags} label="At least 3 tags" />
              </div>
            </BlogSectionCard>

            <BlogSectionCard title="Featured image" icon={<ImageIcon className="w-4 h-4" />} className="!p-4">
              <p className="text-[11px] text-gray-500 mb-3">1980×1080 · .webp · ≤200KB</p>
              {formData.featured_image ? (
                <div className="mb-3 rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={formData.featured_image} alt="Featured preview" className="w-full h-36 object-cover" />
                </div>
              ) : null}
              <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center relative hover:border-brand-primary/40 transition-colors">
                <UploadCloud className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                <div className="text-xs text-gray-600">{uploadingFeatured ? 'Uploading…' : 'Click to upload'}</div>
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
              <label className="label mt-3">Image URL</label>
              <input
                type="url"
                value={formData.featured_image}
                onChange={(e) => setFormData((p: any) => ({ ...p, featured_image: e.target.value }))}
                className={BLOG_INPUT}
              />
              <label className="label mt-3">
                Featured Image ALT <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={String(formData.seo_data?.featured_image_alt || '')}
                onChange={(e) => setFormData((p: any) => ({ ...p, seo_data: { ...p.seo_data, featured_image_alt: e.target.value } }))}
                className={BLOG_INPUT}
                maxLength={125}
              />
              <LimitHint value={String(formData.seo_data?.featured_image_alt || '')} mode="chars" recommended={{ max: 125 }} hardMax={125} />
            </BlogSectionCard>

            <BlogSectionCard title="Categories" className="!p-4">
              <label className="label">Primary category</label>
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
                className={BLOG_INPUT}
              >
                <option value="">Select category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <div className="mt-3 max-h-40 overflow-auto space-y-1.5 pr-1">
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
            </BlogSectionCard>

            <BlogSectionCard title="Tags" icon={<Tag className="w-4 h-4" />} className="!p-4">
              <button type="button" className="btn btn-outline btn-sm w-full mb-2" onClick={autoTagWithAi} disabled={autoTagging || !canGenerateAi}>
                <Sparkles className="w-4 h-4" /> {autoTagging ? 'Auto-tagging…' : 'Auto-Tag (AI)'}
              </button>
              <LimitHint
                value=""
                mode="chars"
                label="Tags selected"
                countOverride={(formData.tag_ids || []).length}
                unitOverride="tags"
                recommended={{ min: 5, max: 10 }}
              />
              {selectedTagWordViolations.length ? (
                <p className="text-[11px] text-amber-700 mt-1">
                  Long tags: {selectedTagWordViolations.slice(0, 2).join(', ')}
                  {selectedTagWordViolations.length > 2 ? '…' : ''}
                </p>
              ) : null}
              <div className="mt-2 max-h-48 overflow-auto space-y-1.5 pr-1">
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
            </BlogSectionCard>

            <BlogSectionCard title="Local SEO" className="!p-4">
              <label className="label">Target city</label>
              <input
                type="text"
                value={String(formData.seo_data?.local_city || '')}
                onChange={(e) => setFormData((p: any) => ({ ...p, seo_data: { ...p.seo_data, local_city: e.target.value } }))}
                className={`${BLOG_INPUT} mb-3`}
                placeholder="e.g. Navi Mumbai"
              />
              <label className="label">Local area (for AI keywords)</label>
              <input
                type="text"
                value={customLocalArea}
                onChange={(e) => setCustomLocalArea(e.target.value)}
                className={BLOG_INPUT}
                placeholder='e.g. "Vartak Nagar, Thane West"'
              />
              <button type="button" className="btn btn-outline btn-sm w-full mt-2" onClick={generateLocalSeoKeywords} disabled={generatingLocalKeywords}>
                {generatingLocalKeywords ? 'Generating…' : 'Generate local keywords'}
              </button>
            </BlogSectionCard>

            <BlogSectionCard title="Schema & indexing" className="!p-4">
              {[
                { key: 'schema_blogposting', label: 'BlogPosting schema' },
                { key: 'schema_faq', label: 'FAQ schema' },
                { key: 'eligible_ai_overview', label: 'AI Overview (SGE)' },
                { key: 'robots_index', label: 'Allow search indexing' },
                { key: 'robots_follow', label: 'Allow follow links' },
              ].map((x) => (
                <label key={x.key} className="flex items-center gap-2 text-sm text-gray-700 mb-2 last:mb-0">
                  <input
                    type="checkbox"
                    checked={Boolean(formData.seo_data?.[x.key] ?? true)}
                    onChange={(e) => setFormData((p: any) => ({ ...p, seo_data: { ...p.seo_data, [x.key]: e.target.checked } }))}
                  />
                  {x.label}
                </label>
              ))}
            </BlogSectionCard>

            <BlogSectionCard title="Publishing" className="!p-4">
              <label className="label">Assign to Author</label>
              <select
                value={formData.author_id || ''}
                onChange={(e) => setFormData((p: any) => ({ ...p, author_id: e.target.value }))}
                className={`${BLOG_INPUT} mb-3`}
              >
                <option value="">Select author</option>
                {authors.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.full_name}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-gray-500 mb-3">Author dashboard par ye blog isi user ko dikhega.</p>
              <label className="label">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData((p: any) => ({ ...p, status: e.target.value }))}
                className={`${BLOG_INPUT} mb-3`}
              >
                <option value="draft">Draft</option>
                <option value="pending_review">Pending Review</option>
                <option value="published">Published</option>
              </select>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={Boolean(formData.is_featured)}
                    onChange={(e) => setFormData((p: any) => ({ ...p, is_featured: e.target.checked }))}
                  />
                  Featured on blog listing
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={Boolean(formData.is_premium)}
                    onChange={(e) => setFormData((p: any) => ({ ...p, is_premium: e.target.checked }))}
                  />
                  Premium content
                </label>
              </div>
              <div className="mt-4 pt-3 border-t border-gray-100 space-y-2">
                <label className="label">Author name</label>
                <input
                  type="text"
                  value={String(formData.seo_data?.author_name || '')}
                  onChange={(e) => setFormData((p: any) => ({ ...p, seo_data: { ...p.seo_data, author_name: e.target.value } }))}
                  className={BLOG_INPUT}
                />
                <label className="label">Author role</label>
                <input
                  type="text"
                  value={String(formData.seo_data?.author_role || '')}
                  onChange={(e) => setFormData((p: any) => ({ ...p, seo_data: { ...p.seo_data, author_role: e.target.value } }))}
                  className={BLOG_INPUT}
                />
              </div>
            </BlogSectionCard>
          </aside>
        </div>
      </div>
    </DashboardLayout>
  );
}
