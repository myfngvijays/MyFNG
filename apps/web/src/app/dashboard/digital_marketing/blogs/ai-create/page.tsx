'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import KeywordIntentBreakdown from '@/components/blog/KeywordIntentBreakdown';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { ArrowLeft, Loader2, Sparkles, Save, Eye } from 'lucide-react';

type Category = { id: string; name: string };
type Tag = { id: string; name: string };

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
      if (!res.ok) throw new Error(data?.error || 'Failed to generate');
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
                </div>
              )}
            </div>
          </div>
        </div>

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
                <h1 className="text-2xl font-bold text-slate-900 mb-2">{draft?.title || 'Untitled'}</h1>
                {draft?.excerpt ? <p className="text-slate-700 mb-6">{draft.excerpt}</p> : null}
                <div
                  className="prose prose-slate max-w-none"
                  // eslint-disable-next-line react/no-danger
                  dangerouslySetInnerHTML={{ __html: draft?.content_html || '<p>No content</p>' }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

