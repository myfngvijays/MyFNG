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
import HtmlStyleEffects from '@/components/blog/HtmlStyleEffects';
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
  const authorDisplayName = String(
    seo?.author_name ||
      (transformed.author as any)?.full_name ||
      (transformed as any)?.author_name ||
      (transformed.author as any)?.name ||
      ''
  ).trim();
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

  const followFacebook = 'https://www.facebook.com/myfngcarservices';
  const followInstagram = 'https://www.instagram.com/myfngcarservices';
  const followYoutube = 'https://youtube.com/channel/UCil_RltFnCtXeAha5TrNtew/';
  const followLinkedin = 'https://linkedin.com/company/myfngcarservices';
  const followX = 'https://x.com/myfngcarservice';
  const playStoreUrl = process.env.NEXT_PUBLIC_PLAY_STORE_URL || '';
  const htmlStyleQuote = highlightQuote || 'Ignoring early engine warning signs can lead to expensive repairs later.';

  return (
      <div className="min-h-screen bg-[#f5f7fb]">
        <style>{`
          .blog-html-wrap{font-family:'Poppins',sans-serif;font-size:13px;color:#222;}
          .blog-html-wrap *{box-sizing:border-box;}
          .blog-html-wrap h1,.blog-html-wrap h2,.blog-html-wrap h3,.blog-html-wrap h4,.blog-html-wrap h5,.blog-html-wrap h6{font-family:'Poppins',sans-serif;color:#111827;}
          .blog-html-wrap .container{max-width:1200px;margin:auto;padding:20px;}
          .blog-html-wrap .breadcrumb{font-size:14px;color:#888;margin-bottom:20px;}
          .blog-html-wrap .blog-title{font-size:32px;font-weight:700;margin-bottom:10px;color:#111827;line-height:1.2;}
          .blog-html-wrap .blog-meta{font-size:13px;color:#777;margin-bottom:20px;display:flex;gap:20px;flex-wrap:wrap;}
          .blog-html-wrap .layout{display:flex;gap:25px;}
          .blog-html-wrap .content-area{flex:3;min-width:0;}
          .blog-html-wrap .sidebar{flex:1;min-width:0;position:sticky;top:90px;height:fit-content;}
          .blog-html-wrap .featured-image{width:100%;border-radius:14px;box-shadow:0 5px 20px rgba(0,0,0,0.1);margin-bottom:20px;}
          .blog-html-wrap .social-wrap{display:flex;gap:30px;margin-bottom:22px;}
          .blog-html-wrap .follow{background:#fff;padding:15px;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,0.06);display:flex;gap:15px;flex-wrap:wrap;width:44%;border:1px solid #006bff;align-items:center;}
          .blog-html-wrap .share{background:#eef2f7;padding:15px;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,0.06);display:flex;gap:15px;flex-wrap:wrap;width:37%;border:1px solid #006bff;align-items:center;}
          .blog-html-wrap .follow-label,.blog-html-wrap .share-label{font-weight:600;color:#333;display:flex;align-items:center;gap:6px;}
          .blog-html-wrap .social-link{color:#0056d2;display:inline-flex;align-items:center;font-size:25px;}
          .blog-html-wrap .quote{background:#0056d2;color:#fff;padding:20px;border-radius:12px;font-style:italic;margin-bottom:25px;}
          .blog-html-wrap .main-content{background:#fff;padding:25px;border-radius:14px;box-shadow:0 2px 14px rgba(0,0,0,0.06);line-height:1.7;color:#333;font-size:15px;}
          .blog-html-wrap .main-content h2{margin:20px 0 10px;font-size:22px;font-weight:700;color:#111827;}
          .blog-html-wrap .main-content h3{margin:16px 0 8px;font-size:18px;font-weight:600;color:#111827;}
          .blog-html-wrap .main-content p{margin-bottom:12px;font-size:15px;}
          .blog-html-wrap .main-content img{width:100%;border-radius:10px;margin:15px 0;}
          .blog-html-wrap .main-content ul{padding-left:20px;}
          .blog-html-wrap .main-content li{margin:6px 0;font-size:15px;}
          .blog-html-wrap .main-content strong{font-weight:600;}
          .blog-html-wrap .tags{margin-top:20px;display:flex;gap:10px;flex-wrap:wrap;align-items:center;}
          .blog-html-wrap .tags span{background:#eef2f7;padding:8px 14px;border-radius:20px;font-size:13px;}
          .blog-html-wrap .faq{margin-top:34px;padding-top:6px;}
          .blog-html-wrap .faq h2{margin:0 0 16px;font-size:26px;line-height:1.2;color:#0a4ea3;}
          .blog-html-wrap .faq-item{background:#fff;border-radius:12px;margin-bottom:12px;padding:18px;box-shadow:0 2px 10px rgba(0,0,0,0.05);}
          .blog-html-wrap .faq-question{display:flex;justify-content:space-between;align-items:center;}
          .blog-html-wrap .faq-item h4{font-size:17px;font-weight:600;margin-bottom:8px;}
          .blog-html-wrap .faq-item p{font-size:14px;color:#555;display:none;margin-top:10px;}
          .blog-html-wrap .faq-item.active p{display:block;}
          .blog-html-wrap .faq-item i{font-size:16px;color:#0a4ea3;transition:.3s;}
          .blog-html-wrap .comment-box{background:#fff;padding:25px;border-radius:14px;margin-top:25px;}
          .blog-html-wrap .comment-box input,.blog-html-wrap .comment-box textarea{width:100%;margin-top:10px;padding:12px;border-radius:10px;border:1px solid #ccc;}
          .blog-html-wrap .comment-box button{margin-top:15px;background:#5fa6d9;color:#fff;border:none;padding:12px 20px;border-radius:10px;cursor:pointer;}
          .blog-html-wrap .side-box{background:#fff;padding:18px;border-radius:12px;margin-bottom:20px;box-shadow:0 2px 12px rgba(0,0,0,0.06);max-width:100%;}
          .blog-html-wrap .search{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;}
          .blog-html-wrap .search input{min-width:0;width:100%;padding:10px;border-radius:8px;border:1px solid #ccc;}
          .blog-html-wrap .search button{background:#0a4ea3;color:#fff;border:none;padding:10px 16px;border-radius:8px;}
          .blog-html-wrap .playstore-badge{display:inline-block;margin-top:10px;max-width:160px;}
          .blog-html-wrap .playstore-badge img{display:block;width:100%;height:auto;}
          .blog-html-wrap .service-slider{position:relative;height:240px;overflow:hidden;border-radius:12px;}
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
          .blog-html-wrap .recent-post{display:flex;gap:10px;margin-bottom:15px;}
          .blog-html-wrap .recent-post img{width:70px;height:70px;object-fit:cover;border-radius:8px;}
          .blog-html-wrap .recent-post a{text-decoration:none;font-size:14px;color:#333;font-weight:500;}
          .blog-html-wrap .categories{display:flex;flex-wrap:wrap;gap:10px;}
          .blog-html-wrap .categories a{background:#eef2f7;padding:8px 14px;border-radius:20px;text-decoration:none;color:#333;font-size:12px;}
          @media(max-width:1024px){
            .blog-html-wrap .layout{flex-direction:column;}
            .blog-html-wrap .sidebar{position:static;}
            .blog-html-wrap .side-box{width:100%;}
            .blog-html-wrap .social-wrap{flex-direction:column;gap:15px;}
            .blog-html-wrap .follow,.blog-html-wrap .share{width:100%;}
            .blog-html-wrap .blog-title{font-size:24px;}
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
                <span className="inline-flex items-center gap-1">
                  <i className="fa fa-user" />
                  {authorDisplayName}
                </span>
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

                <div className="quote">"{htmlStyleQuote}"</div>

                <div className="main-content">
                  {transformed.excerpt ? <p>{transformed.excerpt}</p> : null}
                  <div dangerouslySetInnerHTML={{ __html: transformed.content }} />
                  <div className="tags">
                    <strong>Tags :</strong>
                    {(transformed.tags || []).map((tag) => (tag ? <span key={tag.slug || tag.name}>{tag.name}</span> : null))}
                  </div>
                </div>

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

                <div className="side-box">
                  <h3>Download MyFNG App - Book Car Service Faster</h3>
                  <a
                    href={playStoreUrl || '#'}
                    className="playstore-badge"
                    target={playStoreUrl ? '_blank' : undefined}
                    rel="noreferrer"
                    aria-label="Get it on Google Play"
                  >
                    <img
                      src="https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg"
                      alt="Get it on Google Play"
                    />
                  </a>
                </div>

                <div className="side-box">
                  <h3>Book Your Service</h3>
                  <div className="service-slider">
                    <div className="service-slide active">
                      <img src="https://cffommijlvicfjhbqyzk.supabase.co/storage/v1/object/public/Service_image_public/MyFNG_Car_Periodic_Service.png" alt="Periodic Car Service" />
                      <h4>Periodic Car Service</h4>
                      <a href="/book-service" className="book-btn">Book Now</a>
                    </div>
                    <div className="service-slide">
                      <img src="https://cffommijlvicfjhbqyzk.supabase.co/storage/v1/object/public/Service_image_public/MyFNG_Car_AC_Service.png" alt="Car AC Service" />
                      <h4>Car AC Service</h4>
                      <a href="/book-service" className="book-btn">Book Now</a>
                    </div>
                    <div className="service-slide">
                      <img src="https://cffommijlvicfjhbqyzk.supabase.co/storage/v1/object/public/Service_image_public/MyFNG_Car_Brake_Service.png" alt="Brake Service" />
                      <h4>Brake Service</h4>
                      <a href="/book-service" className="book-btn">Book Now</a>
                    </div>
                  </div>
                </div>

                <div className="side-box">
                  <h3>Recent Posts</h3>
                  {(recentPosts || []).map((p: any) => (
                    <div key={p.id} className="recent-post">
                      <img src={p.featured_image || 'https://images.unsplash.com/photo-1503376780353-7e6692767b70'} alt={p.title} />
                      <Link href={`/blogs/${p.slug}`}>{p.title}</Link>
                    </div>
                  ))}
                </div>

                <div className="side-box">
                  <h3>Related Articles</h3>
                  {(recentPosts || []).map((p: any) => (
                    <div key={`related-${p.id}`} className="recent-post">
                      <img src={p.featured_image || 'https://images.unsplash.com/photo-1503376780353-7e6692767b70'} alt={p.title} />
                      <Link href={`/blogs/${p.slug}`}>{p.title}</Link>
                    </div>
                  ))}
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
              </aside>
            </div>
          </div>
          <HtmlStyleEffects />
        </div>
        <Footer />
      </div>
    );
}
