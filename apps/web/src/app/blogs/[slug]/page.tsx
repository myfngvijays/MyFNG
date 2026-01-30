import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata, Viewport } from 'next';
import { createClient } from '@supabase/supabase-js';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { Calendar, Clock, Eye, Facebook, Instagram, Linkedin, MessageCircle, Tag, Youtube } from 'lucide-react';
import { formatDateDMY } from "@/lib/utils";
import ViewCounter from '@/components/blog/ViewCounter';
import CopyLinkButton from '@/components/blog/CopyLinkButton';
import BlogComments from '@/components/blog/BlogComments';
import { isPuneOrPcmcCity, resolveLocalAreas, PUNE_PCMC_AREAS, normalizeCity } from '@/lib/blog/localSeo';

export const dynamic = 'force-dynamic';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

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

type BlogComment = {
  id: string;
  blog_id: string;
  user_name: string | null;
  comment: string;
  parent_comment_id: string | null;
  status: number | null;
  created_at: string;
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
  const city = normalizeCity(seo?.local_city) || 'Pune';
  const areas = resolveLocalAreas(seo);

  const lat = Number(seo?.geo_lat);
  const lng = Number(seo?.geo_lng);
  const hasLatLng = Number.isFinite(lat) && Number.isFinite(lng);
  const geo: any = hasLatLng ? { '@type': 'GeoCoordinates', latitude: lat, longitude: lng } : undefined;

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

  // LocalBusiness (AutoRepair) – full template style (best-effort)
  graph.push({
    '@type': 'AutoRepair',
    '@id': `${url}#localbusiness`,
    name: `MYFNG Car Service ${city || 'India'}`.trim(),
    alternateName: 'MYFNG - Car Service & Repairs',
    description: desc || undefined,
    url,
    telephone: '+91-9152307030',
    address: {
      '@type': 'PostalAddress',
      addressLocality: city || 'Pune',
      addressRegion: String(seo?.geo_placename || '').includes(',') ? String(seo?.geo_placename || '').split(',').slice(-1)[0].trim() : undefined,
      addressCountry: 'IN',
    },
    geo,
    areaServed: (isPuneOrPcmcCity(city) ? PUNE_PCMC_AREAS : areas).slice(0, 35),
    priceRange: '₹₹',
  });

  // Breadcrumbs
  graph.push({
    '@type': 'BreadcrumbList',
    '@id': `${url}#breadcrumbs`,
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://myfng.in' },
      { '@type': 'ListItem', position: 2, name: 'Blogs', item: 'https://myfng.in/blogs' },
      { '@type': 'ListItem', position: 3, name: title, item: url },
    ],
  });

  if (!graph.length) return null;
  return {
    '@context': 'https://schema.org',
    '@graph': graph,
  };
}

async function fetchPublishedBlogForMeta(slug: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  if (!supabaseUrl || !supabaseAnonKey) return null;
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data } = await supabase
    .from('blogs')
    .select('id, slug, title, excerpt, featured_image, published_at, created_at, seo_data')
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle();
  return data as any;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const blog = await fetchPublishedBlogForMeta(slug);
  if (!blog) return {};

  const seo = (blog.seo_data || {}) as any;
  const title = String(seo?.meta_title || blog.title || '').trim();
  const description = String(seo?.meta_description || blog.excerpt || '').trim();
  const keywords = String(seo?.keywords || '')
    .split(',')
    .map((x: string) => x.trim())
    .filter(Boolean);

  const canonical = String(seo?.canonical_url || `https://myfng.in/blogs/${encodeURIComponent(blog.slug)}`).trim();
  const ogTitle = String(seo?.og_title || title || blog.title || '').trim();
  const ogDesc = String(seo?.og_description || description).trim();
  const ogImage = String(seo?.og_image || blog.featured_image || '').trim() || undefined;

  const city = normalizeCity(seo?.local_city) || 'Pune';
  const areas = resolveLocalAreas(seo);

  // Geo fallback for Pune if not cached (best coverage)
  const lat = Number.isFinite(Number(seo?.geo_lat)) ? Number(seo.geo_lat) : (isPuneOrPcmcCity(city) ? 18.5204 : undefined);
  const lng = Number.isFinite(Number(seo?.geo_lng)) ? Number(seo.geo_lng) : (isPuneOrPcmcCity(city) ? 73.8567 : undefined);
  const geo_position = lat != null && lng != null ? `${lat};${lng}` : undefined;
  const icbm = lat != null && lng != null ? `${lat},${lng}` : undefined;
  const geo_region = String(seo?.geo_region || (isPuneOrPcmcCity(city) ? 'IN-MH' : '')).trim() || undefined;
  const geo_placename = String(seo?.geo_placename || (isPuneOrPcmcCity(city) ? 'Pune, Maharashtra' : city)).trim() || undefined;

  const keyphrase = String(seo?.keyphrase || (keywords[0] || '')).trim() || undefined;
  const keyphraseDesc = String(seo?.keyphrase_description || '').trim() || undefined;
  const googleAiOverview = String(seo?.google_ai_overview || description).trim() || undefined;
  const serpTag = String(seo?.serp_tag || '').trim() || undefined;

  const robotsIndex = seo?.robots_index !== undefined ? Boolean(seo.robots_index) : true;
  const robotsFollow = seo?.robots_follow !== undefined ? Boolean(seo.robots_follow) : true;

  return {
    title,
    description,
    keywords: keywords.length ? keywords : undefined,
    alternates: { canonical },
    robots: {
      index: robotsIndex,
      follow: robotsFollow,
    },
    openGraph: {
      type: 'article',
      title: ogTitle,
      description: ogDesc || undefined,
      url: canonical,
      siteName: 'MYFNG - Car Service & Repairs in India',
      locale: 'en_IN',
      images: ogImage ? [{ url: ogImage }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: ogTitle,
      description: ogDesc || undefined,
      images: ogImage ? [ogImage] : undefined,
    },
    other: {
      ...(googleAiOverview ? { google_ai_overview: googleAiOverview } : {}),
      ...(geo_region ? { 'geo.region': geo_region } : {}),
      ...(geo_placename ? { 'geo.placename': geo_placename } : {}),
      ...(geo_position ? { 'geo.position': geo_position } : {}),
      ...(icbm ? { ICBM: icbm } : {}),
      ...(keyphrase ? { keyphrase } : {}),
      ...(keyphraseDesc ? { 'keyphrase description': keyphraseDesc } : {}),
      ...(areas.length ? { 'local-areas': areas.join(', ') } : {}),
      ...(serpTag ? { 'serp-tag': serpTag } : {}),
      author: canonical,
      copyright: `MYFNG - Best Car Service & Repairs in ${city || 'India'}`,
      rating: 'general',
      distribution: 'Global',
      'revisit-after': '7 days',
    },
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

  const { data: recentPosts } = await supabase
    .from('blogs')
    .select('id, slug, title, featured_image, published_at, created_at')
    .ilike('status', 'published')
    .neq('id', transformed.id)
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(3);

  const { data: categories } = await supabase
    .from('blog_categories')
    .select('id, name, slug, status')
    .or('status.eq.1,status.is.null')
    .order('name', { ascending: true })
    .limit(10);

  const { data: comments } = await supabase
    .from('blog_comments')
    .select('id, blog_id, user_name, comment, parent_comment_id, status, created_at')
    .eq('blog_id', transformed.id)
    .order('created_at', { ascending: true });

  const dateText = formatDateTime(transformed.published_at || transformed.created_at);
  const readTimeText = transformed.read_time ? `${transformed.read_time} min read` : '';
  const views = Number(transformed.views || 0);
  const schema = buildSchemas(transformed);

  const seo: any = (transformed.seo_data || {}) as any;
  const breadcrumbCategory =
    (transformed.categories || []).filter(Boolean)[0] ||
    transformed.category ||
    null;

  const highlightQuote =
    String(seo?.highlight_quote || seo?.highlighted_quote || '').trim() || '';

  const relatedArticlesRaw = seo?.related_articles ?? seo?.relatedArticles ?? seo?.related_urls ?? null;
  const relatedArticles: Array<{ title?: string; url: string }> = Array.isArray(relatedArticlesRaw)
    ? relatedArticlesRaw
        .map((x: any) => {
          if (!x) return null;
          if (typeof x === 'string') return { url: String(x).trim() };
          const url = String(x?.url || x?.href || '').trim();
          const title = String(x?.title || x?.name || '').trim() || undefined;
          if (!url) return null;
          return { url, title };
        })
        .filter(Boolean)
        .slice(0, 6) as any
    : [];

  const shareUrl = `https://myfng.in/blogs/${encodeURIComponent(transformed.slug)}`;
  const waHref = `https://wa.me/?text=${encodeURIComponent(`${transformed.title}\n${shareUrl}`)}`;
  const fbHref = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
  const liHref = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;

  const followFacebook = process.env.NEXT_PUBLIC_SOCIAL_FACEBOOK_URL || '';
  const followInstagram = process.env.NEXT_PUBLIC_SOCIAL_INSTAGRAM_URL || '';
  const followYoutube = process.env.NEXT_PUBLIC_SOCIAL_YOUTUBE_URL || '';
  const followLinkedin = process.env.NEXT_PUBLIC_SOCIAL_LINKEDIN_URL || '';
  const playStoreUrl = process.env.NEXT_PUBLIC_PLAY_STORE_URL || '';

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

      <section className="mt-16 sm:mt-18 md:mt-20 py-6 sm:py-8">
        <div className="container mx-auto px-3 sm:px-4">
          <div className="max-w-6xl mx-auto">
            {/* Breadcrumbs */}
            <nav className="text-xs sm:text-sm text-gray-600 mb-3">
              <ol className="flex flex-wrap items-center gap-1">
                <li>
                  <Link href="/" className="hover:underline">
                    Home
                  </Link>
                </li>
                <li className="text-gray-400">›</li>
                <li>
                  <Link href="/blogs" className="hover:underline">
                    Blogs
                  </Link>
                </li>
                {breadcrumbCategory?.name ? (
                  <>
                    <li className="text-gray-400">›</li>
                    <li>
                      <Link href={`/blogs?category=${encodeURIComponent(breadcrumbCategory.id)}`} className="hover:underline">
                        {breadcrumbCategory.name}
                      </Link>
                    </li>
                  </>
                ) : null}
                <li className="text-gray-400">›</li>
                <li className="text-gray-900 font-medium line-clamp-1">{transformed.title}</li>
              </ol>
            </nav>

            {/* Title */}
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 leading-tight line-clamp-3">
              {transformed.title}
            </h1>

            {/* Meta */}
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs sm:text-sm text-gray-600">
              {dateText ? (
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" />
                  {dateText}
                </div>
              ) : null}
              {transformed.author?.full_name ? <div>By {transformed.author.full_name}</div> : null}
              {readTimeText ? (
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  {readTimeText}
                </div>
              ) : null}
              <div className="flex items-center gap-1.5">
                <Eye className="w-4 h-4" />
                <ViewCounter slug={transformed.slug} initialViews={views} /> views
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Image */}
      {transformed.featured_image ? (
        <section className="pb-6 sm:pb-7 md:pb-8">
          <div className="container mx-auto px-3 sm:px-4">
            <div className="max-w-6xl mx-auto">
              <div className="relative aspect-[16/9] rounded-xl sm:rounded-2xl overflow-hidden shadow-xl bg-gray-200">
                <Image src={transformed.featured_image} alt={transformed.title} fill className="object-cover" priority />
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {/* Follow / Quote / Layout */}
      <section className="pb-10 sm:pb-12 md:pb-14">
        <div className="container mx-auto px-3 sm:px-4">
          <div className="max-w-6xl mx-auto">
            {/* Follow us strip */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 mb-6">
              <div className="flex flex-wrap items-center gap-3 text-sm text-gray-700">
                <div className="font-semibold text-gray-900">Follow Us</div>
                <a
                  href={followFacebook || '#'}
                  target={followFacebook ? '_blank' : undefined}
                  rel={followFacebook ? 'noopener noreferrer' : undefined}
                  aria-disabled={!followFacebook}
                  className={`inline-flex items-center gap-2 ${followFacebook ? 'hover:underline' : 'text-gray-400 cursor-not-allowed'}`}
                >
                  <Facebook className="w-4 h-4" /> Facebook
                </a>
                <a
                  href={followInstagram || '#'}
                  target={followInstagram ? '_blank' : undefined}
                  rel={followInstagram ? 'noopener noreferrer' : undefined}
                  aria-disabled={!followInstagram}
                  className={`inline-flex items-center gap-2 ${followInstagram ? 'hover:underline' : 'text-gray-400 cursor-not-allowed'}`}
                >
                  <Instagram className="w-4 h-4" /> Instagram
                </a>
                <a
                  href={followYoutube || '#'}
                  target={followYoutube ? '_blank' : undefined}
                  rel={followYoutube ? 'noopener noreferrer' : undefined}
                  aria-disabled={!followYoutube}
                  className={`inline-flex items-center gap-2 ${followYoutube ? 'hover:underline' : 'text-gray-400 cursor-not-allowed'}`}
                >
                  <Youtube className="w-4 h-4" /> YouTube
                </a>
                <a
                  href={followLinkedin || '#'}
                  target={followLinkedin ? '_blank' : undefined}
                  rel={followLinkedin ? 'noopener noreferrer' : undefined}
                  aria-disabled={!followLinkedin}
                  className={`inline-flex items-center gap-2 ${followLinkedin ? 'hover:underline' : 'text-gray-400 cursor-not-allowed'}`}
                >
                  <Linkedin className="w-4 h-4" /> LinkedIn
                </a>
              </div>
            </div>

            {highlightQuote ? (
              <div className="bg-gray-900 text-white rounded-xl p-5 sm:p-6 mb-6">
                <div className="text-sm sm:text-base leading-relaxed italic">
                  “{highlightQuote}”
                </div>
              </div>
            ) : null}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
              {/* Main content */}
              <div className="lg:col-span-8">
                <article className="bg-white rounded-xl shadow-lg p-4 sm:p-6 md:p-8">
                  {/* Tags + Share */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
                    <div className="flex flex-wrap gap-2">
                      {transformed.tags && transformed.tags.length > 0
                        ? transformed.tags.map((tag) =>
                            tag ? (
                              <span
                                key={tag.slug || tag.name}
                                className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm"
                              >
                                <Tag className="w-3 h-3" />
                                {tag.name}
                              </span>
                            ) : null
                          )
                        : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={fbHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-3 py-2 bg-blue-50 hover:bg-blue-100 rounded-lg transition text-blue-800 text-xs sm:text-sm font-semibold"
                        title="Share on Facebook"
                      >
                        <Facebook className="w-4 h-4" />
                        Facebook
                      </a>
                      <a
                        href={waHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-3 py-2 bg-green-50 hover:bg-green-100 rounded-lg transition text-green-800 text-xs sm:text-sm font-semibold"
                        title="Share on WhatsApp"
                      >
                        <MessageCircle className="w-4 h-4" />
                        WhatsApp
                      </a>
                      <a
                        href={liHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-3 py-2 bg-sky-50 hover:bg-sky-100 rounded-lg transition text-sky-800 text-xs sm:text-sm font-semibold"
                        title="Share on LinkedIn"
                      >
                        <Linkedin className="w-4 h-4" />
                        LinkedIn
                      </a>
                      <CopyLinkButton url={shareUrl} />
                    </div>
                  </div>

                  {transformed.excerpt ? (
                    <p className="text-gray-700 text-sm sm:text-base leading-relaxed mb-6">
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

                  <BlogComments blogId={transformed.id} initialComments={(comments || []) as BlogComment[]} />
                </article>
              </div>

              {/* Sidebar */}
              <aside className="lg:col-span-4 space-y-5">
                {/* Search */}
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="font-semibold text-gray-900 mb-3">Search</div>
                  <form action="/blogs" method="GET" className="flex gap-2">
                    <input
                      name="q"
                      placeholder="Search blogs by keyword"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
                    />
                    <button type="submit" className="btn btn-primary text-sm px-4 py-2">
                      Search
                    </button>
                  </form>
                </div>

                {/* Download app */}
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="font-semibold text-gray-900 mb-3">Download Our App</div>
                  <a
                    href={playStoreUrl || '#'}
                    target={playStoreUrl ? '_blank' : undefined}
                    rel={playStoreUrl ? 'noopener noreferrer' : undefined}
                    aria-disabled={!playStoreUrl}
                    className={`btn btn-primary w-full justify-center ${!playStoreUrl ? 'opacity-60 pointer-events-none' : ''}`}
                  >
                    Play Store
                  </a>
                </div>

                {/* Recent posts */}
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="font-semibold text-gray-900 mb-3">Recent Posts</div>
                  <div className="space-y-3">
                    {(recentPosts || []).map((p: any) => (
                      <Link key={p.id} href={`/blogs/${p.slug}`} className="flex gap-3 hover:bg-gray-50 rounded-lg p-2 transition">
                        <div className="relative w-16 h-12 rounded-md overflow-hidden bg-gray-200 flex-shrink-0">
                          {p.featured_image ? (
                            <Image src={p.featured_image} alt={p.title} fill className="object-cover" />
                          ) : null}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-gray-900 line-clamp-2">{p.title}</div>
                          <div className="text-xs text-gray-500">{formatDate(p.published_at || p.created_at)}</div>
                        </div>
                      </Link>
                    ))}
                    {(recentPosts || []).length === 0 ? <div className="text-sm text-gray-600">No recent posts.</div> : null}
                  </div>
                </div>

                {/* Related articles (from SEO config; blank if not set) */}
                {relatedArticles.length ? (
                  <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="font-semibold text-gray-900 mb-3">Related Articles</div>
                    <ul className="space-y-2 text-sm">
                      {relatedArticles.slice(0, 6).map((a) => (
                        <li key={a.url}>
                          <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-brand-primary hover:underline">
                            {a.title || a.url}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {/* Categories */}
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="font-semibold text-gray-900 mb-3">Categories</div>
                  <div className="flex flex-wrap gap-2">
                    {(categories || []).map((c: any) => (
                      <Link
                        key={c.id}
                        href={`/blogs?category=${encodeURIComponent(c.id)}`}
                        className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-xs font-semibold text-gray-800 transition"
                      >
                        {c.name}
                      </Link>
                    ))}
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

