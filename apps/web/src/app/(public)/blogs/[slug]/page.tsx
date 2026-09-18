import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata, Viewport } from 'next';
import { createClient } from '@supabase/supabase-js';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { Calendar, Clock, Eye, Facebook, Instagram, Linkedin, MessageCircle, Tag, Youtube } from 'lucide-react';
import { formatDateDMY, formatDateTimeISTAssumeUTC } from "@/lib/utils";
import { computeReadTimeFromHtml } from '@/lib/blog/text';
import ViewCounter from '@/components/blog/ViewCounter';
import CopyLinkButton from '@/components/blog/CopyLinkButton';
import BlogComments from '@/components/blog/BlogComments';
import HtmlStyleEffects from '@/components/blog/HtmlStyleEffects';
import BlogPrimeBanner from '@/components/blog/BlogPrimeBanner';
import BlogPostCta from '@/components/blog/BlogPostCta';
import { isPuneOrPcmcCity, resolveLocalAreas, PUNE_PCMC_AREAS, normalizeCity } from '@/lib/blog/localSeo';
import { DEFAULT_SERVICES } from '@/lib/services/catalog';
import { buildGoAppDownloadUrl } from '@/lib/blog/blogAppDownload';
import {
  normalizeBlogMediaAbsoluteUrl,
  normalizeBlogMediaUrl,
  normalizeBlogSeoData,
} from '@/lib/blog/normalizeBlogMedia';
import { normalizeBlogContentForDisplay } from '@/lib/blog/normalizeBlogContent';
import { buildBlogTrackedPath, ensureAboutMyFngHtml, ensureIntroAndToc, ensureLocalSeoHtml, splitBlogHtmlAtMidpoint, stripExistingCta } from '@/lib/blog/aiLinks';
import { ensureAiOverviewHtml, ensureRsaAiOverviewHtml } from '@/lib/blog/dailyAiOverview';
import { isMyFngServiceFaq, isNewsCarBlog, stripMyFngServiceHtml } from '@/lib/blog/newsCarBlog';
import { ensureSeoBlogTitle, rewriteCityDashTitle } from '@/lib/blog/generateAiDraft';
import { PUBLIC_BLOG_AUTHOR_HREF, publicBlogAuthorName, publicBlogByline } from '@/lib/blog/publicAuthor';

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

function blogSlugFromHref(href: string) {
  const path = String(href || '').replace(/^https?:\/\/[^/?#]+/i, '');
  const match = path.match(/\/blogs\/([^/?#]+)/i);
  if (!match?.[1]) return '';
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function displayBlogCardTitle(title: string, seo?: Record<string, unknown> | null) {
  const city = String(seo?.local_city || seo?.ai_city || '').trim();
  if (city && (seo?.ai_daily_post || seo?.ai_batch_post)) {
    return ensureSeoBlogTitle(title, city);
  }
  return rewriteCityDashTitle(title);
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
  const authorName = publicBlogAuthorName(blog);
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
      author: { '@type': 'Person', name: authorName, url: `https://myfng.in${PUBLIC_BLOG_AUTHOR_HREF}` },
      publisher: {
        '@type': 'Organization',
        name: 'MyFNG',
        url: 'https://myfng.in',
      },
      image: featuredImage ? [normalizeBlogMediaAbsoluteUrl(String(featuredImage))] : undefined,
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
  const titleCity = String(seo?.local_city || seo?.ai_city || '').trim();
  const rawTitle = String(seo?.meta_title || blog.title || '').trim();
  const title = titleCity && (seo?.ai_daily_post || seo?.ai_batch_post)
    ? ensureSeoBlogTitle(rawTitle, titleCity)
    : rawTitle;
  const description = String(seo?.meta_description || blog.excerpt || '').trim();
  const keywords = String(seo?.keywords || '')
    .split(',')
    .map((x: string) => x.trim())
    .filter(Boolean);

  const canonical = String(seo?.canonical_url || `https://myfng.in/blogs/${encodeURIComponent(blog.slug)}`).trim();
  const ogTitle = titleCity && (seo?.ai_daily_post || seo?.ai_batch_post)
    ? ensureSeoBlogTitle(String(seo?.og_title || title || blog.title || '').trim(), titleCity)
    : String(seo?.og_title || title || blog.title || '').trim();
  const ogDesc = String(seo?.og_description || description).trim();
  const ogImage =
    normalizeBlogMediaAbsoluteUrl(String(seo?.og_image || blog.featured_image || '').trim()) || undefined;

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
    featured_image: blog.featured_image ? normalizeBlogMediaUrl(String(blog.featured_image)) : blog.featured_image,
    content: '',
    seo_data: normalizeBlogSeoData(blog.seo_data as Record<string, unknown> | null | undefined),
    tags: (blog as any)?.tags?.map((t: any) => t?.tag).filter(Boolean) || [],
    categories: (blog as any)?.categories?.map((c: any) => c?.category).filter(Boolean) || [],
    faqs: (faqs || []).map((f: any) => ({ question: f.question, answer: f.answer })),
  };

  const { data: recentPosts } = await supabase
    .from('blogs')
    .select('id, slug, title, featured_image, published_at, created_at, seo_data')
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

  const seo: any = (transformed.seo_data || {}) as any;
  if (isNewsCarBlog(seo)) {
    transformed.faqs = (transformed.faqs || []).filter((f) => !isMyFngServiceFaq(f.question, f.answer));
  }
  const titleCity = String(seo?.local_city || seo?.ai_city || '').trim();
  if (titleCity && (seo?.ai_daily_post || seo?.ai_batch_post)) {
    transformed.title = ensureSeoBlogTitle(transformed.title, titleCity);
  }
  const authorDisplayName = publicBlogByline(transformed);
  (transformed.seo_data as any).author_name = authorDisplayName;

  const dateText = formatDateTimeISTAssumeUTC(transformed.published_at || transformed.created_at);
  const views = Number(transformed.views || 0);
  const schema = buildSchemas(transformed);
  const breadcrumbCategory =
    (transformed.categories || []).filter(Boolean)[0] ||
    transformed.category ||
    null;

  const highlightQuote =
    String(transformed.excerpt || '').trim() ||
    String(seo?.highlight_quote || seo?.highlighted_quote || seo?.meta_description || '').trim() ||
    '';

  const relatedArticlesRaw = seo?.related_articles ?? seo?.relatedArticles ?? seo?.related_urls ?? null;
  const relatedArticles: Array<{ title?: string; url: string }> = Array.isArray(relatedArticlesRaw)
    ? relatedArticlesRaw
        .map((x: any) => {
          if (!x) return null;
          if (typeof x === 'string') return { url: String(x).trim() };
          const url = String(x?.url || x?.href || '').trim();
          const title = rewriteCityDashTitle(String(x?.title || x?.name || '').trim()) || undefined;
          if (!url) return null;
          return { url, title };
        })
        .filter(Boolean)
        .slice(0, 3) as any
    : [];

  const relatedSlugs = [...new Set(relatedArticles.map((a) => blogSlugFromHref(a.url)).filter(Boolean))];
  const { data: relatedRows } = relatedSlugs.length
    ? await supabase
        .from('blogs')
        .select('id, slug, title, featured_image, seo_data')
        .in('slug', relatedSlugs)
        .eq('status', 'published')
    : { data: [] as any[] };
  const relatedBySlug = new Map((relatedRows || []).map((row: any) => [String(row.slug), row]));

  const shareUrl = `https://myfng.in/blogs/${encodeURIComponent(transformed.slug)}`;
  const waHref = `https://wa.me/?text=${encodeURIComponent(`${transformed.title}\n${shareUrl}`)}`;
  const fbHref = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
  const liHref = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;

  const followFacebook = 'https://www.facebook.com/myfngcarservices';
  const followInstagram = 'https://www.instagram.com/myfngcarservices';
  const followYoutube = 'https://youtube.com/channel/UCil_RltFnCtXeAha5TrNtew/';
  const followLinkedin = 'https://linkedin.com/company/myfngcarservices';
  const followX = 'https://x.com/myfngcarservice';
  const bookHref = (placement: string) =>
    buildBlogTrackedPath('/book-service', transformed.slug, placement, String(seo?.keywords || '').split(',')[0]);
  const relatedSidebar = (relatedArticles.length
    ? relatedArticles.map((a, i) => {
        const slug = blogSlugFromHref(a.url);
        const row = slug ? relatedBySlug.get(slug) : null;
        return {
          id: row?.id || `rel-${i}`,
          slug: slug || a.url,
          title: row ? displayBlogCardTitle(String(row.title || a.title || ''), row.seo_data) : (a.title || a.url),
          featured_image: row?.featured_image || '',
          href: slug ? `/blogs/${slug}` : a.url,
        };
      })
    : (recentPosts || []).map((p: any) => ({
        ...p,
        title: displayBlogCardTitle(String(p.title || ''), p.seo_data),
        href: `/blogs/${p.slug}`,
      }))
  ).slice(0, 3);
  const htmlStyleQuote = highlightQuote;
  const appDownloadHref =
    String(seo?.app_download_url || '').trim() ||
    buildGoAppDownloadUrl({
      slug: transformed.slug,
      focusKeyword: String(seo?.keywords || '').split(',')[0],
      content: 'app-download',
    });
  const newsCar = isNewsCarBlog(seo as Record<string, unknown>);
  const rsaPost = Boolean(seo?.ai_rsa_post);
  const rawDisplay = normalizeBlogContentForDisplay(String(blog.content || ''));
  const withLocal = ensureLocalSeoHtml(
    ensureIntroAndToc(stripExistingCta(rawDisplay), highlightQuote),
    {
      city: String(seo?.local_city || seo?.ai_city || '').trim(),
      areas: Array.isArray(seo?.local_areas) ? seo.local_areas : [],
      keywords: Array.isArray(seo?.local_keywords) ? seo.local_keywords : [],
    },
  );
  transformed.content = newsCar
    ? ensureIntroAndToc(stripMyFngServiceHtml(stripExistingCta(rawDisplay)), highlightQuote)
    : ensureAboutMyFngHtml(
        rsaPost ? ensureRsaAiOverviewHtml(withLocal) : ensureAiOverviewHtml(withLocal),
        appDownloadHref,
      );
  transformed.content = rewriteCityDashTitle(transformed.content);
  const contentHalves = newsCar
    ? { first: transformed.content, second: '' }
    : splitBlogHtmlAtMidpoint(transformed.content);
  const readMinutes = computeReadTimeFromHtml(transformed.content).minutes;
  const readTimeText = `${readMinutes} min read`;

  return (
      <div className="min-h-screen bg-[#f5f7fb]">
        <style>{`
          .blog-html-wrap{font-family:'Poppins',sans-serif;font-size:13px;color:#222;}
          .blog-html-wrap *{box-sizing:border-box;}
          .blog-html-wrap h1,.blog-html-wrap h2,.blog-html-wrap h3,.blog-html-wrap h4,.blog-html-wrap h5,.blog-html-wrap h6{font-family:'Poppins',sans-serif;color:#111827;}
          .blog-html-wrap .container{max-width:1200px;margin:auto;padding:20px;}
          .blog-html-wrap .breadcrumb{font-size:14px;color:#888;margin-bottom:20px;}
          .blog-html-wrap .blog-title{font-size:36px;font-weight:700;margin-bottom:10px;color:#111827;line-height:1.2;}
          .blog-html-wrap .blog-meta{font-size:13px;color:#777;margin-bottom:20px;display:flex;gap:20px;flex-wrap:wrap;}
          .blog-html-wrap .blog-meta a{color:#0a4ea3;font-weight:600;text-decoration:none;}
          .blog-html-wrap .blog-meta a:hover{text-decoration:underline;}
          .blog-html-wrap .layout{display:flex;gap:25px;}
          .blog-html-wrap .content-area{flex:3;min-width:0;}
          .blog-html-wrap .sidebar{flex:1;min-width:0;position:sticky;top:90px;height:fit-content;}
          .blog-html-wrap .featured-image{width:100%;border-radius:14px;box-shadow:0 5px 20px rgba(0,0,0,0.1);margin-bottom:20px;display:block;}
          .blog-html-wrap .social-wrap{display:flex;gap:30px;margin-bottom:22px;}
          .blog-html-wrap .follow{background:#fff;padding:15px;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,0.06);display:flex;gap:15px;flex-wrap:wrap;width:44%;border:1px solid #006bff;align-items:center;}
          .blog-html-wrap .share{background:#eef2f7;padding:15px;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,0.06);display:flex;gap:15px;flex-wrap:wrap;width:37%;border:1px solid #006bff;align-items:center;}
          .blog-html-wrap .follow-label,.blog-html-wrap .share-label{font-weight:600;color:#333;display:flex;align-items:center;gap:6px;}
          .blog-html-wrap .social-link{color:#0056d2;display:inline-flex;align-items:center;font-size:25px;}
          .blog-html-wrap .quote{background:#0056d2;color:#fff;padding:20px 22px;border-radius:12px;font-style:italic;margin-bottom:25px;font-size:15px;line-height:1.6;}
          .blog-html-wrap .main-content{background:#fff;padding:25px;border-radius:14px;box-shadow:0 2px 14px rgba(0,0,0,0.06);line-height:1.7;color:#333;font-size:15px;}
          .blog-html-wrap .main-content h2{margin:20px 0 10px;font-size:22px;font-weight:700;color:#111827;}
          .blog-html-wrap .main-content h3{margin:16px 0 8px;font-size:18px;font-weight:600;color:#111827;}
          .blog-html-wrap .main-content p{margin-bottom:12px;font-size:15px;}
          .blog-html-wrap .main-content img{width:100%;border-radius:10px;margin:15px 0;}
          .blog-html-wrap .main-content ul{list-style:disc;padding-left:1.5rem;margin:14px 0;}
          .blog-html-wrap .main-content ol{list-style:decimal;padding-left:1.5rem;margin:14px 0;}
          .blog-html-wrap .main-content li{display:list-item;margin:8px 0;font-size:15px;line-height:1.6;}
          .blog-html-wrap .main-content ul ul,.blog-html-wrap .main-content ol ol{margin:6px 0;}
          .blog-html-wrap .main-content a{color:#0a4ea3;text-decoration:underline;}
          .blog-html-wrap .main-content strong{font-weight:600;}
          .blog-html-wrap .main-content h2:not(:first-child){margin-top:28px;}
          .blog-html-wrap .blog-toc{margin:0 0 22px;padding:18px 20px;border-radius:12px;background:#f4f8ff;border:1px solid #d7e6ff;}
          .blog-html-wrap .blog-toc h2{margin:0 0 10px !important;font-size:16px !important;font-weight:700;color:#0a4ea3;}
          .blog-html-wrap .blog-toc ol{margin:0;padding-left:1.25rem;}
          .blog-html-wrap .blog-toc li{margin:6px 0;font-size:14px;}
          .blog-html-wrap .blog-toc a{color:#0a4ea3;text-decoration:none;font-weight:600;}
          .blog-html-wrap .blog-toc a:hover{text-decoration:underline;}
          .blog-html-wrap .blog-aio-summary{margin:0 0 22px;padding:18px 20px;border-radius:12px;background:#fff8eb;border:1px solid #f3d7a3;}
          .blog-html-wrap .blog-aio-summary h2{margin:0 0 10px !important;font-size:16px !important;font-weight:700;color:#92400e;}
          .blog-html-wrap .blog-aio-summary ul{margin:8px 0 0;}
          .blog-html-wrap .blog-prime-banner{display:block;margin:28px 0 12px;padding:14px 18px;border-radius:14px;text-decoration:none;color:#fff;background:#023D95;border:1px solid rgba(255,255,255,.18);box-shadow:0 2px 14px rgba(2,61,149,0.18);animation:blog-prime-shift 6s linear infinite;}
          @keyframes blog-prime-shift{0%,100%{background-color:#023D95;}50%{background-color:#DC2626;}}
          @media (prefers-reduced-motion:reduce){.blog-html-wrap .blog-prime-banner{animation:none;}}
          .blog-html-wrap .blog-prime-banner-row{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;}
          .blog-html-wrap .blog-prime-banner-kicker{display:inline-flex;align-items:center;gap:8px;font-size:15px;font-weight:800;letter-spacing:.04em;color:#f6e27a;}
          .blog-html-wrap .blog-prime-banner-tag{margin:4px 0 0;font-size:12px;line-height:1.4;color:rgba(255,255,255,.82);}
          .blog-html-wrap .blog-prime-banner-price{text-align:right;flex-shrink:0;}
          .blog-html-wrap .blog-prime-banner-price-row{display:flex;align-items:baseline;gap:6px;}
          .blog-html-wrap .blog-prime-banner-price strong{display:inline;font-size:22px;line-height:1;font-weight:800;}
          .blog-html-wrap .blog-prime-banner-price span{font-size:14px;color:rgba(255,255,255,.88);font-weight:700;}
          .blog-html-wrap .blog-prime-banner-price em{display:block;margin-top:6px;font-size:14px;font-style:normal;color:#f6e27a;font-weight:700;}
          .blog-html-wrap .blog-prime-banner-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;}
          .blog-html-wrap .blog-prime-banner-chips span{padding:4px 8px;border-radius:999px;background:rgba(255,255,255,.12);font-size:11px;font-weight:600;line-height:1.3;color:#fff;}
          .blog-html-wrap .blog-post-cta{margin:16px 0 12px;padding:22px 24px;border-radius:14px;background:linear-gradient(135deg,#eef4ff 0%,#f8fbff 100%);border:1px solid #cfe0ff;}
          .blog-html-wrap .blog-post-cta h3{margin:0 0 8px;font-size:18px;font-weight:700;color:#0a4ea3;}
          .blog-html-wrap .blog-post-cta p{margin:0 0 14px;font-size:14px;color:#475569;line-height:1.6;}
          .blog-html-wrap .blog-post-cta-actions{display:flex;flex-wrap:nowrap;gap:10px;}
          .blog-html-wrap .blog-post-cta a,
          .blog-html-wrap .blog-post-cta .book-btn,
          .blog-html-wrap .blog-post-cta .app-btn,
          .blog-html-wrap .blog-post-cta-phone{display:inline-flex;align-items:center;justify-content:center;padding:12px 14px;flex:1 1 0;min-width:0;margin:0;border-radius:10px;font-size:13px;font-weight:700;text-decoration:none;line-height:1.2;text-align:center;}
          .blog-html-wrap .blog-post-cta .cta-short{display:none;}
          .blog-html-wrap .blog-post-cta .app-btn{background:#023D95;color:#fff;}
          .blog-html-wrap .blog-post-cta .book-btn{background:#0a4ea3;color:#fff;}
          .blog-html-wrap .blog-post-cta-phone{border:2px solid #0a4ea3;color:#0a4ea3;background:#fff;}
          .blog-html-wrap .main-content .blog-post-cta a{color:#fff;}
          .blog-html-wrap .main-content .blog-post-cta .blog-post-cta-phone{color:#0a4ea3;}
          .blog-html-wrap .side-box .categories{max-height:220px;overflow:auto;}
          .blog-html-wrap .tags{margin-top:20px;display:flex;gap:10px;flex-wrap:wrap;align-items:center;}
          .blog-html-wrap .tags span{background:#eef2f7;padding:8px 14px;border-radius:20px;font-size:13px;}
          .blog-html-wrap .faq{margin-top:34px;padding-top:6px;}
          .blog-html-wrap .faq h2{margin:0 0 16px;font-size:24px;line-height:1.2;color:#0a4ea3;}
          .blog-html-wrap .faq-item{background:#fff;border-radius:12px;margin-bottom:12px;padding:18px;box-shadow:0 2px 10px rgba(0,0,0,0.05);}
          .blog-html-wrap .faq-question{display:flex;justify-content:space-between;align-items:center;}
          .blog-html-wrap .faq-item h4{font-size:15px;font-weight:600;margin-bottom:8px;}
          .blog-html-wrap .faq-item p{font-size:12px;color:#555;display:none;margin-top:10px;}
          .blog-html-wrap .faq-item.active p{display:block;}
          .blog-html-wrap .faq-item i{font-size:14px;color:#0a4ea3;transition:.3s;}
          .blog-html-wrap .comment-box{background:#fff;padding:20px 25px 25px;border-radius:14px;margin-top:16px;}
          .blog-html-wrap .comment-box input,.blog-html-wrap .comment-box textarea{width:100%;margin-top:10px;padding:12px;border-radius:10px;border:1px solid #ccc;}
          .blog-html-wrap .comment-box button{margin-top:15px;background:#0a4ea3;color:#fff;border:none;padding:12px 20px;border-radius:10px;cursor:pointer;}
          .blog-html-wrap .side-box{background:#fff;padding:18px;border-radius:12px;margin-bottom:20px;box-shadow:0 2px 12px rgba(0,0,0,0.06);max-width:100%;}
          .blog-html-wrap .side-box h3{margin:0 0 16px;font-size:18px;line-height:1.3;}
          .blog-html-wrap .search{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;}
          .blog-html-wrap .search input{min-width:0;width:100%;padding:10px;border-radius:8px;border:1px solid #ccc;}
          .blog-html-wrap .search button{background:#0a4ea3;color:#fff;border:none;padding:10px 16px;border-radius:8px;}
          .blog-html-wrap .sidebar-app-btn{display:flex;align-items:center;justify-content:center;width:100%;margin-top:8px;padding:12px 16px;border-radius:10px;background:#023D95;color:#fff;font-weight:700;text-decoration:none;font-size:14px;}
          .blog-html-wrap .service-slider{position:relative;height:270px;overflow:hidden;border-radius:12px;}
          .blog-html-wrap .service-slide{background:#fff;padding:15px;border-radius:12px;box-shadow:0 2px 10px rgba(0,0,0,0.08);text-align:center;margin-top:12px;}
          .blog-html-wrap .service-slider .service-slide{
            position:absolute;
            width:100%;
            height:100%;
            top:0;
            left:100%;
            opacity:0;
            transition:.6s ease;
            margin-top:0;
          }
          .blog-html-wrap .service-slider .service-slide.active{
            left:0;
            opacity:1;
          }
          .blog-html-wrap .service-slide img{width:100%;height:130px;object-fit:cover;border-radius:10px;margin-bottom:10px;}
          .blog-html-wrap .service-slide h4{font-size:16px;margin-bottom:10px;color:#0a4ea3;}
          .blog-html-wrap .book-btn{display:block;background:#0a4ea3;color:#fff;padding:10px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:500;}
          .blog-html-wrap .recent-post{margin-bottom:22px;}
          .blog-html-wrap .recent-post:last-child{margin-bottom:0;}
          .blog-html-wrap .recent-post a.recent-post-link{display:flex;gap:14px;align-items:flex-start;text-decoration:none;color:inherit;}
          .blog-html-wrap .recent-post img{width:112px;aspect-ratio:16/9;height:auto;object-fit:cover;border-radius:10px;flex-shrink:0;background:#e8eef6;}
          .blog-html-wrap .recent-post .recent-post-title{font-size:14px;color:#333;font-weight:600;line-height:1.4;padding-top:2px;}
          .blog-html-wrap .categories{display:flex;flex-wrap:wrap;gap:10px;}
          .blog-html-wrap .categories a{background:#eef2f7;padding:8px 14px;border-radius:20px;text-decoration:none;color:#333;font-size:12px;}
          @media(max-width:1024px){
            .blog-html-wrap .layout{flex-direction:column;}
            .blog-html-wrap .sidebar{position:static;}
            .blog-html-wrap .side-box{width:100%;}
            .blog-html-wrap .social-wrap{flex-direction:column;gap:15px;}
            .blog-html-wrap .follow,.blog-html-wrap .share{width:100%;}
            .blog-html-wrap .blog-title{font-size:32px;}
            .blog-html-wrap .blog-prime-banner-row{flex-direction:column;gap:8px;}
            .blog-html-wrap .blog-prime-banner-price{text-align:left;}
            .blog-html-wrap .blog-prime-banner-price em{font-size:15px;}
            .blog-html-wrap .blog-post-cta{padding:16px 14px;}
            .blog-html-wrap .blog-post-cta h3{font-size:16px;}
            .blog-html-wrap .blog-post-cta p{font-size:13px;margin-bottom:12px;}
            .blog-html-wrap .blog-post-cta-actions{gap:6px;}
            .blog-html-wrap .blog-post-cta a,
            .blog-html-wrap .blog-post-cta .book-btn,
            .blog-html-wrap .blog-post-cta .app-btn,
            .blog-html-wrap .blog-post-cta-phone{padding:10px 6px;font-size:11px;}
            .blog-html-wrap .blog-post-cta .cta-full{display:none;}
            .blog-html-wrap .blog-post-cta .cta-short{display:inline;}
          }
        `}</style>
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700;800&display=swap" rel="stylesheet" />
        <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" rel="stylesheet" />
        {schema ? (
          <script
            type="application/ld+json"
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
          />
        ) : null}
        <Navbar />
        <div className="blog-html-wrap">
          <div className="container" style={{ marginTop: '80px' }}>
            <div className="breadcrumb">
              Home &gt; Blogs {breadcrumbCategory?.name ? `> ${breadcrumbCategory.name}` : ''} &gt; {transformed.title}
            </div>

            <h1 className="blog-title">{transformed.title}</h1>

            <div className="blog-meta">
              {authorDisplayName ? (
                <Link href={PUBLIC_BLOG_AUTHOR_HREF} className="inline-flex items-center gap-1">
                  <i className="fa fa-user" />
                  {authorDisplayName}
                </Link>
              ) : null}
              {dateText ? (
                <span className="inline-flex items-center gap-1">
                  <i className="fa fa-calendar" />
                  {dateText}
                </span>
              ) : null}
              {readTimeText ? (
                <span className="inline-flex items-center gap-1">
                  <i className="fa fa-clock" />
                  {readTimeText}
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1">
                <i className="fa fa-eye" />
                <ViewCounter slug={transformed.slug} initialViews={views} /> views
              </span>
            </div>

            <div className="layout">
              <div className="content-area">
                {transformed.featured_image ? (
                  <Image
                    src={transformed.featured_image}
                    alt={transformed.title}
                    width={1000}
                    height={560}
                    className="featured-image"
                    priority
                  />
                ) : null}

                <div className="social-wrap">
                  <div className="follow">
                    <strong className="follow-label"><i className="fa-solid fa-user-plus" style={{ color: '#013d95' }} /> Follow Us:</strong>
                    {followFacebook ? (
                      <a href={followFacebook} className="social-link" target="_blank" rel="noreferrer">
                        <i className="fa-brands fa-square-facebook fa-fade" style={{ color: '#0091ff' }} />
                      </a>
                    ) : null}
                    {followInstagram ? (
                      <a href={followInstagram} className="social-link" target="_blank" rel="noreferrer">
                        <i className="fa-brands fa-square-instagram fa-fade" style={{ color: '#d62976' }} />
                      </a>
                    ) : null}
                    {followYoutube ? (
                      <a href={followYoutube} className="social-link" target="_blank" rel="noreferrer">
                        <i className="fa-brands fa-youtube fa-fade" style={{ color: '#ff0000' }} />
                      </a>
                    ) : null}
                    {followLinkedin ? (
                      <a href={followLinkedin} className="social-link" target="_blank" rel="noreferrer">
                        <i className="fa-brands fa-linkedin fa-fade" style={{ color: '#0a66c2' }} />
                      </a>
                    ) : null}
                    {followX ? (
                      <a href={followX} className="social-link" target="_blank" rel="noreferrer">
                        <i className="fa-brands fa-square-twitter fa-fade" style={{ color: '#1da1f2' }} />
                      </a>
                    ) : null}
                  </div>

                  <div className="share">
                    <strong className="share-label"><i className="fa-solid fa-share-nodes" style={{ color: '#013d95' }} /> Share Us:</strong>
                    <a href={waHref} className="social-link" target="_blank" rel="noreferrer">
                      <i className="fa-brands fa-whatsapp fa-fade" style={{ color: '#25d366' }} />
                    </a>
                    <a href={fbHref} className="social-link" target="_blank" rel="noreferrer">
                      <i className="fa-brands fa-square-facebook fa-fade" style={{ color: '#0091ff' }} />
                    </a>
                    <a href={followInstagram} className="social-link" target="_blank" rel="noreferrer">
                      <i className="fa-brands fa-square-instagram fa-fade" style={{ color: '#d62976' }} />
                    </a>
                    <a href={liHref} className="social-link" target="_blank" rel="noreferrer">
                      <i className="fa-brands fa-linkedin fa-fade" style={{ color: '#0a66c2' }} />
                    </a>
                  </div>
                </div>

                {htmlStyleQuote ? <div className="quote">"{htmlStyleQuote}"</div> : null}

                <div className="main-content">
                  <div dangerouslySetInnerHTML={{ __html: contentHalves.first }} />
                </div>

                {newsCar || !contentHalves.second ? null : (
                  <BlogPostCta appHref={appDownloadHref} bookHref={bookHref('mid-article-cta')} />
                )}

                {contentHalves.second ? (
                  <div className="main-content" style={{ marginTop: 16 }}>
                    <div dangerouslySetInnerHTML={{ __html: contentHalves.second }} />
                  </div>
                ) : null}

                {newsCar ? null : (
                <>
                <BlogPrimeBanner
                  href={buildGoAppDownloadUrl({
                    slug: transformed.slug,
                    focusKeyword: String(seo?.keywords || '').split(',')[0],
                    content: 'prime-banner',
                  })}
                />
                <BlogPostCta appHref={appDownloadHref} bookHref={bookHref('public-footer-cta')} />
                </>
                )}

                {transformed.faqs && transformed.faqs.length ? (
                  <div className="faq">
                    <h2>FAQs</h2>
                    {transformed.faqs.slice(0, 8).map((f, idx) => (
                      <div key={`${idx}-${f.question}`} className="faq-item">
                        <div className="faq-question">
                          <h4>{f.question}</h4>
                          <i className="fa fa-plus" />
                        </div>
                        <p>{f.answer}</p>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="comment-box">
                  <BlogComments blogId={transformed.id} initialComments={(comments || []) as BlogComment[]} />
                </div>
              </div>

              <aside className="sidebar">
                <div className="side-box">
                  <h3>Search</h3>
                  <form action="/blogs" method="GET" className="search">
                    <input name="q" placeholder="Search blogs by keyword" />
                    <button type="submit">Search</button>
                  </form>
                </div>

                {newsCar ? null : (
                <>
                <div className="side-box">
                  <h3>Download MyFNG App</h3>
                  <p style={{ margin: '0 0 10px', fontSize: 13, color: '#475569', lineHeight: 1.5 }}>
                    Book pickup &amp; drop and track your service from the app.
                  </p>
                  <a href={appDownloadHref} className="sidebar-app-btn">
                    Download App
                  </a>
                </div>

                <div className="side-box">
                  <h3>Book Your Service</h3>
                  <div className="service-slider">
                    {DEFAULT_SERVICES.map((svc, idx) => (
                      <div key={svc.slug} className={`service-slide${idx === 0 ? ' active' : ''}`}>
                        <img src={svc.image} alt={svc.title} />
                        <h4>{svc.title}</h4>
                        <a href={bookHref(`sidebar-${svc.slug}`)} className="book-btn">Book Now</a>
                      </div>
                    ))}
                  </div>
                </div>
                </>
                )}

                <div className="side-box">
                  <h3>Recent Posts</h3>
                  {(recentPosts || []).map((p: any) => {
                    const title = displayBlogCardTitle(String(p.title || ''), p.seo_data);
                    const href = `/blogs/${p.slug}`;
                    return (
                      <div key={p.id} className="recent-post">
                        <Link href={href} className="recent-post-link">
                          <img src={normalizeBlogMediaUrl(String(p.featured_image || '')) || 'https://images.unsplash.com/photo-1503376780353-7e6692767b70'} alt={title} />
                          <span className="recent-post-title">{title}</span>
                        </Link>
                      </div>
                    );
                  })}
                </div>

                <div className="side-box">
                  <h3>Related Articles</h3>
                  {relatedSidebar.map((p: any) => {
                    const href = p.href || `/blogs/${p.slug}`;
                    const img = normalizeBlogMediaUrl(String(p.featured_image || '')) || 'https://images.unsplash.com/photo-1503376780353-7e6692767b70';
                    return (
                      <div key={`related-${p.id}`} className="recent-post">
                        {String(href).startsWith('http') ? (
                          <a href={href} className="recent-post-link">
                            <img src={img} alt={p.title} />
                            <span className="recent-post-title">{p.title}</span>
                          </a>
                        ) : (
                          <Link href={href} className="recent-post-link">
                            <img src={img} alt={p.title} />
                            <span className="recent-post-title">{p.title}</span>
                          </Link>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="side-box">
                  <h3>Categories</h3>
                  <div className="categories">
                    {(categories || []).map((c: any) => (
                      <Link key={c.id} href={`/blogs?category=${encodeURIComponent(c.id)}`}>
                        {c.name}
                      </Link>
                    ))}
                  </div>
                </div>

                {(transformed.tags || []).filter(Boolean).length ? (
                  <div className="side-box">
                    <h3>Tags</h3>
                    <div className="categories">
                      {(transformed.tags || []).slice(0, 15).map((tag) =>
                        tag ? (
                          <Link key={tag.slug || tag.name} href={`/blogs?q=${encodeURIComponent(tag.name)}`}>
                            {tag.name}
                          </Link>
                        ) : null
                      )}
                    </div>
                    {(transformed.tags || []).length > 15 ? (
                      <p className="text-xs text-gray-500 mt-2">+{(transformed.tags || []).length - 15} more tags</p>
                    ) : null}
                  </div>
                ) : null}
              </aside>
            </div>
          </div>
          <HtmlStyleEffects />
        </div>
        <Footer />
      </div>
    );
}
