'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import KeywordIntentBreakdown from '@/components/blog/KeywordIntentBreakdown';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { ArrowLeft, Loader2, Sparkles, Save, Eye } from 'lucide-react';
import { PUBLIC_BLOG_AUTHOR } from '@/lib/blog/publicAuthor';

type Category = { id: string; name: string };
type Tag = { id: string; name: string };

type AiDraftLink = { kind?: string; anchor: string; url: string };

type AiDraft = {
  title: string;
  slug: string;
  excerpt: string;
  content_html: string;
  seo: {
    meta_title: string;
    meta_description: string;
    keywords: string;
    og_title: string;
    og_description: string;
    cta_text?: string;
    cta_url?: string;
    related_articles?: Array<{ title: string; url: string }>;
  };
  links?: {
    has_cta?: boolean;
    cta_url?: string;
    internal?: AiDraftLink[];
    external?: AiDraftLink[];
    related_articles?: Array<{ title: string; url: string }>;
  };
  read_time: number;
};

export default function AICreateBlogPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);

  const [topic, setTopic] = useState('');
  const [focusKeyword, setFocusKeyword] = useState('');
  const [city, setCity] = useState('Pune');
  const [intent, setIntent] = useState<'Informational' | 'Commercial/Transactional' | 'Local / Navigational'>('Informational');
  const [tone, setTone] = useState<'Professional' | 'Friendly' | 'Hindi + English (Hinglish)'>('Professional');
  const [wordCount, setWordCount] = useState(900);
  const [categoryId, setCategoryId] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  const [draft, setDraft] = useState<AiDraft | null>(null);

  useEffect(() => {
    fetchCategories();
    fetchTags();
  }, []);

  useEffect(() => {
    if (!showPreview) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowPreview(false);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [showPreview]);

  async function fetchCategories() {
    try {
      const res = await fetch('/api/blogs/categories');
      if (!res.ok) return;
      const data = await res.json().catch(() => ({}));
      setCategories((data?.categories || []) as Category[]);
    } catch {
      // ignore
    }
  }

  async function fetchTags() {
    try {
      const res = await fetch('/api/blogs/tags');
      if (!res.ok) return;
      const data = await res.json().catch(() => ({}));
      setTags((data?.tags || []) as Tag[]);
    } catch {
      // ignore
    }
  }

  const canGenerate = useMemo(() => {
    return topic.trim().length >= 6;
  }, [topic]);

  async function generate() {
    if (!canGenerate) {
      toast.error('Please enter a blog topic (min 6 chars).');
      return;
    }
    try {
      setLoading(true);
      const res = await fetch('/api/blogs/ai-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          focusKeyword,
          city,
          intent,
          tone,
          wordCount,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = String(data?.error || data?.details || 'Failed to generate').slice(0, 220);
        throw new Error(detail);
      }
      setDraft(data?.draft as AiDraft);
      toast.success('Draft generated');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to generate');
    } finally {
      setLoading(false);
    }
  }

  async function createBlog(status: 'draft' | 'pending_review' | 'published') {
    if (!draft) return;
    try {
      setSaving(true);
      const payload: any = {
        title: draft.title,
        slug: draft.slug,
        excerpt: draft.excerpt,
        content: draft.content_html,
        category_id: categoryId || null,
        category_ids: categoryId ? [categoryId] : [],
        featured_image: '',
        read_time: draft.read_time || 5,
        status,
        is_featured: false,
        is_premium: false,
        tag_ids: selectedTagIds,
        image_urls: [],
        faqs: [], // FAQs are generated separately (AI FAQs button in editor)
        seo_data: {
          meta_title: draft.seo.meta_title,
          meta_description: draft.seo.meta_description,
          keywords: draft.seo.keywords,
          canonical_url: '',
          og_title: draft.seo.og_title,
          og_description: draft.seo.og_description,
          og_image: '',
          // Helpful metadata
          search_intent: intent,
          schema_blogposting: true,
          schema_faq: true,
          eligible_ai_overview: true,
          ai_generated: true,
          ai_topic: topic,
          ai_city: city,
          cta_text: draft.seo.cta_text || 'Book Service Now',
          cta_url: draft.seo.cta_url || draft.links?.cta_url || '',
          related_articles: draft.seo.related_articles || draft.links?.related_articles || [],
          author_name: PUBLIC_BLOG_AUTHOR,
        },
      };

      const res = await fetch('/api/blogs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to create blog');

      toast.success(status === 'published' ? 'Blog published' : status === 'pending_review' ? 'Sent for review' : 'Draft created');
      router.push(`/dashboard/digital_marketing/blogs/${data.blog.id}/edit`);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to create blog');
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardLayout role="digital_marketing">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/digital_marketing/blogs">
              <button type="button" className="btn btn-outline btn-sm">
                <ArrowLeft className="w-4 h-4" />
              </button>
            </Link>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-text-heading">AI Written Blogs</h1>
              <p className="text-text-body mt-1">Generate SEO blog drafts and publish fast</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-1 space-y-4">
            <div className="card">
              <h2 className="text-base font-semibold text-text-heading mb-3">AI Inputs</h2>

              <label className="block text-sm font-medium text-text-heading mb-1">Topic *</label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                placeholder="e.g. Best car service in Pune (price + checklist)"
              />

              <label className="block text-sm font-medium text-text-heading mt-3 mb-1">Focus Keyword</label>
              <input
                type="text"
                value={focusKeyword}
                onChange={(e) => setFocusKeyword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                placeholder="e.g. car service in pune"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                <div>
                  <label className="block text-sm font-medium text-text-heading mb-1">City</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-heading mb-1">Word Count</label>
                  <input
                    type="number"
                    value={wordCount}
                    onChange={(e) => setWordCount(Number.parseInt(e.target.value || '900', 10) || 900)}
                    min={400}
                    max={2500}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                  />
                </div>
              </div>

              <label className="block text-sm font-medium text-text-heading mt-3 mb-1">Search Intent</label>
              <select
                value={intent}
                onChange={(e) => setIntent(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent bg-white"
              >
                <option>Informational</option>
                <option>Commercial/Transactional</option>
                <option>Local / Navigational</option>
              </select>

              <KeywordIntentBreakdown
                title={String(draft?.title || topic || '')}
                excerpt={String(draft?.excerpt || '')}
                contentHtml={String(draft?.content_html || '')}
                focusKeywords={String(draft?.seo?.keywords || focusKeyword || '')}
              />

              <label className="block text-sm font-medium text-text-heading mt-3 mb-1">Tone</label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent bg-white"
              >
                <option>Professional</option>
                <option>Friendly</option>
                <option>Hindi + English (Hinglish)</option>
              </select>

              <p className="mt-3 text-xs text-slate-500">
                Every draft auto-adds a MyFNG Book Service CTA, internal links to MyFNG pages / related blogs, and UTM
                params. External reference links are added only when a real source is cited.
              </p>

              <button
                type="button"
                onClick={generate}
                disabled={loading || !canGenerate}
                className="btn btn-primary w-full mt-4 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Generate Draft
              </button>
            </div>

            <div className="card">
              <h2 className="text-base font-semibold text-text-heading mb-3">Assign Category & Tags</h2>
              <label className="block text-sm font-medium text-text-heading mb-1">Category</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent bg-white"
              >
                <option value="">Select category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              <div className="mt-3 max-h-56 overflow-auto border border-gray-200 rounded-lg p-2">
                {tags.map((t) => (
                  <label key={t.id} className="flex items-center gap-2 text-sm py-1">
                    <input
                      type="checkbox"
                      checked={selectedTagIds.includes(t.id)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedTagIds((p) => [...p, t.id]);
                        else setSelectedTagIds((p) => p.filter((x) => x !== t.id));
                      }}
                    />
                    <span className="truncate">{t.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-4">
            <div className="card">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
                <h2 className="text-base font-semibold text-text-heading">Generated Draft</h2>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn btn-outline btn-sm flex items-center gap-2"
                    disabled={!draft}
                    onClick={() => setShowPreview(true)}
                  >
                    <Eye className="w-4 h-4" />
                    Preview
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm flex items-center gap-2"
                    disabled={!draft || saving}
                    onClick={() => createBlog('draft')}
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Create Draft
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm flex items-center gap-2"
                    disabled={!draft || saving}
                    onClick={() => createBlog('pending_review')}
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Send for Review
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm flex items-center gap-2"
                    disabled={!draft || saving}
                    onClick={() => createBlog('published')}
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Publish
                  </button>
                </div>
              </div>

              {!draft ? (
                <div className="text-sm text-gray-600">
                  Fill AI inputs and click <b>Generate Draft</b>.
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <div className="text-xs text-gray-500">Title</div>
                    <div className="font-semibold">{draft.title}</div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <div className="text-xs text-gray-500">Slug</div>
                      <div className="font-mono text-sm break-all">{draft.slug}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Read time</div>
                      <div className="text-sm">{draft.read_time} min</div>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Excerpt</div>
                    <div className="text-sm text-gray-700">{draft.excerpt}</div>
                  </div>
                  <div className="border-t pt-3">
                    <div className="text-xs text-gray-500 mb-2">Content (HTML)</div>
                    <textarea
                      value={draft.content_html}
                      onChange={(e) => setDraft((p) => (p ? { ...p, content_html: e.target.value } : p))}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg font-mono resize-y"
                      rows={14}
                    />
                  </div>
                  {draft.links ? (
                    <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-blue-800">
                        Auto links
                      </div>
                      <p className="mt-1 text-sm text-slate-700">
                        CTA {draft.links.has_cta ? 'included' : 'missing'} ·{' '}
                        {(draft.links.internal || []).length} internal · {(draft.links.external || []).length} external
                        (UTM on every http link)
                      </p>
                      <ul className="mt-2 max-h-36 space-y-1 overflow-auto text-xs text-slate-600">
                        {(draft.links.internal || []).slice(0, 8).map((l, i) => (
                          <li key={`in-${i}`} className="truncate">
                            Internal: {l.anchor} — {l.url}
                          </li>
                        ))}
                        {(draft.links.external || []).slice(0, 4).map((l, i) => (
                          <li key={`ex-${i}`} className="truncate">
                            External: {l.anchor} — {l.url}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </div>

        {showPreview && typeof document !== 'undefined'
          ? createPortal(
              <div
                className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-3 sm:p-4"
                onClick={() => setShowPreview(false)}
              >
                <div
                  className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex shrink-0 items-center justify-between border-b px-4 py-3">
                    <div className="font-semibold text-slate-900">Preview</div>
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowPreview(false)}>
                      Close
                    </button>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 pb-16">
                    <h1 className="mb-2 text-2xl font-bold text-slate-900">{draft?.title || 'Untitled'}</h1>
                    {draft?.excerpt ? <p className="mb-6 text-slate-700">{draft.excerpt}</p> : null}
                    <style>{`
                      .blog-ai-preview .blog-post-cta{margin-top:28px;padding:22px 24px;border-radius:14px;background:linear-gradient(135deg,#eef4ff 0%,#f8fbff 100%);border:1px solid #cfe0ff;}
                      .blog-ai-preview .blog-post-cta h3{margin:0 0 8px;font-size:18px;font-weight:700;color:#0a4ea3;}
                      .blog-ai-preview .blog-post-cta p{margin:0 0 14px;font-size:14px;color:#475569;line-height:1.6;}
                      .blog-ai-preview .blog-post-cta-actions{display:flex;flex-wrap:wrap;gap:10px;}
                      .blog-ai-preview .blog-post-cta .book-btn{display:inline-flex;align-items:center;justify-content:center;padding:10px 18px;border-radius:8px;background:#0a4ea3;color:#fff;text-decoration:none;font-weight:600;}
                      .blog-ai-preview .blog-post-cta-phone{display:inline-flex;align-items:center;padding:10px 16px;border-radius:8px;border:1px solid #0a4ea3;color:#0a4ea3;text-decoration:none;font-size:14px;font-weight:600;background:#fff;}
                      .blog-ai-preview a{color:#0a4ea3;text-decoration:underline;}
                    `}</style>
                    <div
                      className="blog-ai-preview blog-content prose prose-slate max-w-none break-words"
                      // eslint-disable-next-line react/no-danger
                      dangerouslySetInnerHTML={{ __html: draft?.content_html || '<p>No content</p>' }}
                    />
                  </div>
                </div>
              </div>,
              document.body,
            )
          : null}
      </div>
    </DashboardLayout>
  );
}

