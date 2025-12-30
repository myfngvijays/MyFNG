import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { ArrowLeft, Calendar, Clock, Eye, Facebook, Linkedin, Link2, MessageCircle, Tag } from 'lucide-react';
import { formatDateDMY } from "@/lib/utils";
import ViewCounter from '@/components/blog/ViewCounter';

export const dynamic = 'force-dynamic';

type BlogTag = { name: string; slug: string } | null;
type BlogCategory = { id: string; name: string; slug: string } | null;

type Blog = {
  id: string;
  slug: string;
  title: string;
  excerpt?: string | null;
  content: string;
  read_time?: number | null;
  featured_image?: string | null;
  published_at?: string | null;
  created_at?: string | null;
  views?: number | null;
  seo_data?: any;
  category?: { id: string; name: string; slug: string } | null;
  categories?: BlogCategory[];
  author?: { id: string; full_name: string | null; email: string | null } | null;
  tags?: BlogTag[];
  faqs?: Array<{ question: string; answer: string }>;
};

function formatDate(dateString?: string | null) {
  if (!dateString) return '';
  const d = new Date(dateString);
  return formatDateDMY(d);
}

function formatDateTime(dateString?: string | null) {
  if (!dateString) return '';
  const d = new Date(dateString);
  const date = formatDateDMY(d);
  const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  return `${date} ${time}`;
}

function buildSchemas(blog: Blog) {
  const seo = (blog.seo_data || {}) as any;
  const enableBlogPosting = Boolean(seo?.schema_blogposting);
  const enableFaq = Boolean(seo?.schema_faq);
  const enableSge = Boolean(seo?.eligible_ai_overview);

  const url = `https://myfng.in/blogs/${encodeURIComponent(blog.slug)}`;
  const title = String(blog.title || '').trim();
  const desc = String(seo?.meta_description || blog.excerpt || '').trim();
  const keywords = String(seo?.keywords || '').trim();
  const publishedAt = blog.published_at || blog.created_at || null;
  const authorName = String(seo?.author_name || blog.author?.full_name || 'MyFNG').trim();
  const featuredImage = blog.featured_image || seo?.og_image || null;

  const graph: any[] = [];

  if (enableBlogPosting) {
    graph.push({
      '@type': 'BlogPosting',
      '@id': `${url}#blogposting`,
      mainEntityOfPage: url,
      headline: title,
      description: desc || undefined,
      datePublished: publishedAt || undefined,
      dateModified: blog.created_at || publishedAt || undefined,
      author: { '@type': 'Person', name: authorName },
      publisher: {
        '@type': 'Organization',
        name: 'MyFNG',
        url: 'https://myfng.in',
      },
      image: featuredImage ? [featuredImage] : undefined,
      keywords: keywords || undefined,
    });
  }

  if (enableFaq && blog.faqs && blog.faqs.length) {
    graph.push({
      '@type': 'FAQPage',
      '@id': `${url}#faq`,
      mainEntity: blog.faqs
        .filter((f) => (f.question || '').trim() && (f.answer || '').trim())
        .map((f) => ({
          '@type': 'Question',
          name: String(f.question).trim(),
          acceptedAnswer: { '@type': 'Answer', text: String(f.answer).trim() },
        })),
    });
  }

  // SGE toggle: keep it short, descriptive, and aligned to the same page.
  if (enableSge) {
    graph.push({
      '@type': 'Article',
      '@id': `${url}#ai-overview`,
      headline: title,
      description: desc || undefined,
      mainEntityOfPage: url,
      datePublished: publishedAt || undefined,
      author: { '@type': 'Organization', name: 'MyFNG' },
      keywords: keywords || undefined,
    });
  }

  if (!graph.length) return null;
  return {
    '@context': 'https://schema.org',
    '@graph': graph,
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  if (!supabaseUrl || !supabaseAnonKey) notFound();

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const { data: blog, error } = await supabase
    .from('blogs')
    .select(
      `
        *,
        category:blog_categories(*),
        categories:blog_category_mapping(
          is_primary,
          category:blog_categories(*)
        ),
        author:users_login!author_id(id, full_name, email),
        tags:blog_tag_mapping(
          tag:blog_tags(*)
        )
      `
    )
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle();

  if (error || !blog) notFound();

  const { data: faqs } = await supabase
    .from('blog_faqs')
    .select('question, answer, sort_order')
    .eq('blog_id', blog.id)
    .order('sort_order', { ascending: true });

  const transformed: Blog = {
    ...blog,
    tags: (blog as any)?.tags?.map((t: any) => t?.tag).filter(Boolean) || [],
    categories: (blog as any)?.categories?.map((c: any) => c?.category).filter(Boolean) || [],
    faqs: (faqs || []).map((f: any) => ({ question: f.question, answer: f.answer })),
  };

  const dateText = formatDateTime(transformed.published_at || transformed.created_at);
  const readTimeText = transformed.read_time ? `${transformed.read_time} min read` : '';
  const views = Number(transformed.views || 0);
  const schema = buildSchemas(transformed);

  const shareUrl = `https://myfng.in/blogs/${encodeURIComponent(transformed.slug)}`;
  const shareText = encodeURIComponent(transformed.title);
  const waHref = `https://wa.me/?text=${encodeURIComponent(`${transformed.title}\n${shareUrl}`)}`;
  const fbHref = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
  const liHref = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      {schema ? (
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ) : null}

      {/* Header */}
      <section className="bg-gradient-to-br from-gray-900 via-blue-900 to-gray-800 py-12 sm:py-16 md:py-20 mt-16 sm:mt-18 md:mt-20">
        <div className="container mx-auto px-3 sm:px-4">
          <div className="max-w-4xl mx-auto">
            <Link
              href="/blogs"
              className="inline-flex items-center gap-1.5 sm:gap-2 text-gray-200 hover:text-white mb-4 sm:mb-5 md:mb-6 transition text-sm sm:text-base"
            >
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
              Back to Blogs
            </Link>

            {transformed.categories && transformed.categories.length ? (
              <div className="mb-3 sm:mb-4 flex flex-wrap gap-2">
                {transformed.categories
                  .filter(Boolean)
                  .slice(0, 6)
                  .map((c) => (
                    <span
                      key={(c as any).id || (c as any).slug || (c as any).name}
                      className="bg-brand-primary text-white px-3 sm:px-4 py-0.5 sm:py-1 rounded-full text-xs sm:text-sm font-semibold"
                    >
                      {(c as any).name}
                    </span>
                  ))}
              </div>
            ) : transformed.category?.name ? (
              <div className="mb-3 sm:mb-4">
                <span className="bg-brand-primary text-white px-3 sm:px-4 py-0.5 sm:py-1 rounded-full text-xs sm:text-sm font-semibold">
                  {transformed.category.name}
                </span>
              </div>
            ) : null}

            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-4 sm:mb-5 md:mb-6 text-white">
              {transformed.title}
            </h1>

            <div className="flex flex-wrap items-center gap-3 sm:gap-4 md:gap-6 text-gray-200 text-xs sm:text-sm">
              {dateText ? (
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  {dateText}
                </div>
              ) : null}
              {readTimeText ? (
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  {readTimeText}
                </div>
              ) : null}
              {transformed.author?.full_name ? <div>By {transformed.author.full_name}</div> : null}
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <ViewCounter slug={transformed.slug} initialViews={views} /> views
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Image */}
      {transformed.featured_image ? (
        <section className="py-6 sm:py-7 md:py-8">
          <div className="container mx-auto px-3 sm:px-4">
            <div className="max-w-4xl mx-auto">
              <div className="relative h-48 sm:h-64 md:h-80 lg:h-96 rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl bg-gray-200">
                <Image src={transformed.featured_image} alt={transformed.title} fill className="object-cover" priority />
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {/* Content */}
      <section className="py-6 sm:py-7 md:py-8">
        <div className="container mx-auto px-3 sm:px-4">
          <div className="max-w-4xl mx-auto">
            <article className="bg-white rounded-xl sm:rounded-2xl shadow-lg p-4 sm:p-6 md:p-8 lg:p-12">
              {/* Tags */}
              {transformed.tags && transformed.tags.length > 0 ? (
                <div className="flex flex-wrap gap-2 mb-6 sm:mb-7 md:mb-8">
                  {transformed.tags.map((tag) =>
                    tag ? (
                      <span
                        key={tag.slug || tag.name}
                        className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs sm:text-sm"
                      >
                        <Tag className="w-3 h-3" />
                        {tag.name}
                      </span>
                    ) : null
                  )}
                </div>
              ) : null}

              {transformed.excerpt ? (
                <p className="text-gray-700 text-sm sm:text-base leading-relaxed mb-6 sm:mb-7 md:mb-8">
                  {transformed.excerpt}
                </p>
              ) : null}

              {/* Content (HTML supported as per dashboard editor helper text) */}
              <div
                className="prose prose-sm sm:prose-base md:prose-lg max-w-none"
                dangerouslySetInnerHTML={{ __html: transformed.content }}
              />

              {/* FAQs (editable + schema source) */}
              {transformed.faqs && transformed.faqs.length ? (
                <div className="mt-10 sm:mt-12">
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">FAQs</h2>
                  <div className="space-y-4">
                    {transformed.faqs.slice(0, 8).map((f, idx) => (
                      <div key={`${idx}-${f.question}`} className="border border-gray-200 rounded-xl p-4">
                        <div className="font-semibold text-gray-900">{f.question}</div>
                        <div className="text-gray-700 mt-1">{f.answer}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Social Sharing */}
              <div className="mt-8 sm:mt-10 md:mt-12 pt-6 sm:pt-7 md:pt-8 border-t border-gray-200">
                <div className="flex flex-wrap gap-2">
                  <a
                    href={waHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 hover:bg-green-100 rounded-full transition text-green-800 text-xs sm:text-sm font-semibold"
                    title="Share on WhatsApp"
                  >
                    <MessageCircle className="w-4 h-4" />
                    WhatsApp
                  </a>
                  <a
                    href={fbHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 rounded-full transition text-blue-800 text-xs sm:text-sm font-semibold"
                    title="Share on Facebook"
                  >
                    <Facebook className="w-4 h-4" />
                    Facebook
                  </a>
                  <a
                    href={liHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-sky-50 hover:bg-sky-100 rounded-full transition text-sky-800 text-xs sm:text-sm font-semibold"
                    title="Share on LinkedIn"
                  >
                    <Linkedin className="w-4 h-4" />
                    LinkedIn
                  </a>
                  <a
                    href={shareUrl}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-full transition text-gray-700 text-xs sm:text-sm font-semibold"
                    title="Copy link"
                    onClick={(e) => {
                      e.preventDefault();
                      if (typeof navigator !== 'undefined' && navigator.clipboard) {
                        navigator.clipboard.writeText(shareUrl).catch(() => null);
                      }
                    }}
                  >
                    <Link2 className="w-4 h-4" />
                    Copy Link
                  </a>
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

