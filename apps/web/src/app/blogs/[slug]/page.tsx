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
  const isExactHtmlStylePage = transformed.slug === 'what-to-do-when-you-need-towing-service-near-me-in-pune';
  const htmlStyleQuote = highlightQuote || 'Ignoring early engine warning signs can lead to expensive repairs later.';

  if (isExactHtmlStylePage) {
    return (
      <div className="min-h-screen bg-[#f5f7fb]">
        <style>{`
          .blog-html-wrap .header{background:#fff;box-shadow:0 2px 10px rgba(0,0,0,0.08);position:sticky;top:0;z-index:1000;}
          .blog-html-wrap .navbar{max-width:1200px;margin:auto;display:flex;align-items:center;justify-content:space-between;padding:12px 20px;}
          .blog-html-wrap .logo img{height:38px;}
          .blog-html-wrap .nav-links{display:flex;gap:25px;align-items:center;}
          .blog-html-wrap .nav-links a{text-decoration:none;color:#333;font-weight:500;font-size:15px;}
          .blog-html-wrap .header-buttons{display:flex;gap:15px;}
          .blog-html-wrap .btn-outline{border:1px solid #0a4ea3;padding:8px 16px;border-radius:10px;text-decoration:none;color:#0a4ea3;font-weight:500;}
          .blog-html-wrap .btn-primary{background:#0a4ea3;padding:9px 18px;border-radius:10px;color:#fff;text-decoration:none;font-weight:500;}
          .blog-html-wrap .hamburger{display:none;font-size:22px;cursor:pointer;background:transparent;border:none;color:#111827;}
          .blog-html-wrap .mobile-menu{display:none;flex-direction:column;background:#fff;padding:15px;}
          .blog-html-wrap .mobile-menu a{padding:10px 0;text-decoration:none;color:#333;}
          .blog-html-wrap .container{max-width:1200px;margin:auto;padding:20px;}
          .blog-html-wrap .breadcrumb{font-size:14px;color:#888;margin-bottom:20px;}
          .blog-html-wrap .blog-title{font-size:32px;font-weight:700;margin-bottom:10px;color:#111827;line-height:1.2;}
          .blog-html-wrap .blog-meta{font-size:13px;color:#777;margin-bottom:20px;display:flex;gap:20px;flex-wrap:wrap;}
          .blog-html-wrap .layout{display:flex;gap:25px;}
          .blog-html-wrap .content-area{flex:3;}
          .blog-html-wrap .sidebar{flex:1;position:sticky;top:90px;height:fit-content;}
          .blog-html-wrap .featured-image{width:100%;border-radius:14px;box-shadow:0 5px 20px rgba(0,0,0,0.1);margin-bottom:20px;}
          .blog-html-wrap .social-wrap{display:flex;gap:192px;margin-bottom:22px;}
          .blog-html-wrap .follow{background:#fff;padding:15px;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,0.06);display:flex;gap:15px;flex-wrap:wrap;width:44%;border:1px solid #006bff;align-items:center;}
          .blog-html-wrap .share{background:#eef2f7;padding:15px;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,0.06);display:flex;gap:15px;flex-wrap:wrap;width:37%;border:1px solid #006bff;align-items:center;}
          .blog-html-wrap .follow-label,.blog-html-wrap .share-label{font-weight:600;color:#333;display:flex;align-items:center;gap:6px;}
          .blog-html-wrap .social-link{color:#0056d2;display:inline-flex;align-items:center;font-size:25px;}
          .blog-html-wrap .quote{background:#0056d2;color:#fff;padding:20px;border-radius:12px;font-style:italic;margin-bottom:25px;}
          .blog-html-wrap .main-content{background:#fff;padding:25px;border-radius:14px;box-shadow:0 2px 14px rgba(0,0,0,0.06);line-height:1.7;color:#333;}
          .blog-html-wrap .main-content h2{margin:20px 0 10px;}
          .blog-html-wrap .main-content img{width:100%;border-radius:10px;margin:15px 0;}
          .blog-html-wrap .main-content ul{padding-left:20px;}
          .blog-html-wrap .main-content li{margin:6px 0;}
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
          .blog-html-wrap .side-box{background:#fff;padding:18px;border-radius:12px;margin-bottom:20px;box-shadow:0 2px 12px rgba(0,0,0,0.06);width:325px;max-width:100%;}
          .blog-html-wrap .search{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;}
          .blog-html-wrap .search input{min-width:0;width:100%;padding:10px;border-radius:8px;border:1px solid #ccc;}
          .blog-html-wrap .search button{background:#0a4ea3;color:#fff;border:none;padding:10px 16px;border-radius:8px;}
          .blog-html-wrap .playstore-badge{display:inline-block;margin-top:10px;max-width:220px;}
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
            .blog-html-wrap .nav-links,.blog-html-wrap .header-buttons{display:none;}
            .blog-html-wrap .hamburger{display:block;}
            .blog-html-wrap .layout{flex-direction:column;}
            .blog-html-wrap .sidebar{position:static;}
            .blog-html-wrap .side-box{width:100%;}
            .blog-html-wrap .social-wrap{flex-direction:column;gap:20px;}
            .blog-html-wrap .follow,.blog-html-wrap .share{width:100%;}
          }
        `}</style>
        <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" rel="stylesheet" />
        {schema ? (
          <script
            type="application/ld+json"
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
          />
        ) : null}
        <div className="blog-html-wrap">
          <header className="header">
            <div className="navbar">
              <div className="logo">
                <img src="https://myfng.in/logo.png" alt="MyFNG" />
              </div>
              <div className="nav-links">
                <a href="/">Home</a>
                <a href="/services">Services</a>
                <a href="/about">About</a>
                <a href="/car-roadside-assitance">Roadside Assistance</a>
                <a href="/blogs">Blog</a>
                <a href="/contact">Contact</a>
              </div>
              <div className="header-buttons">
                <a href="/login" className="btn-outline">Partner Login</a>
                <a href="/login" className="btn-primary">Customer Login</a>
              </div>
              <button type="button" id="blogHamburgerBtn" className="hamburger" aria-label="Toggle menu">
                <i className="fa fa-bars" />
              </button>
            </div>
            <div className="mobile-menu" id="mobileMenu">
              <a href="/">Home</a>
              <a href="/services">Services</a>
              <a href="/about">About</a>
              <a href="/car-roadside-assitance">Roadside Assistance</a>
              <a href="/blogs">Blog</a>
              <a href="/contact">Contact</a>
            </div>
          </header>
          <div className="container">
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
      </div>
    );
  }

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

            {/* Author Name - at top */}
            {authorDisplayName ? (
              <div className="mt-2 text-sm sm:text-base font-semibold text-gray-800">
                Author: {authorDisplayName}
              </div>
            ) : null}

            {/* Meta */}
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs sm:text-sm text-gray-600">
              {dateText ? (
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" />
                  {dateText}
                </div>
              ) : null}
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

      {/* Main content + sidebar layout */}
      <section className="pb-10 sm:pb-12 md:pb-14">
        <div className="container mx-auto px-3 sm:px-4">
          <div className="max-w-6xl mx-auto">
            {highlightQuote ? (
              <div className="bg-gray-900 text-white rounded-xl p-5 sm:p-6 mb-6">
                <div className="text-sm sm:text-base leading-relaxed italic">
                  “{highlightQuote}”
                </div>
              </div>
            ) : null}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
              {/* Left column: featured image (smaller, left) + article */}
              <div className="lg:col-span-8 space-y-6">
                {/* Featured image - left side, smaller */}
                {transformed.featured_image ? (
                  <div className="relative w-full max-w-lg aspect-[16/10] sm:aspect-[2/1] rounded-xl overflow-hidden shadow-lg bg-gray-200">
                    <Image src={transformed.featured_image} alt={transformed.title} fill className="object-cover" priority />
                  </div>
                ) : null}

                <article className="bg-white rounded-xl shadow-lg p-4 sm:p-6 md:p-8">
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

                  {/* Tags & Share - after blog content */}
                  <div className="mt-8 pt-6 border-t border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
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
                      {(!transformed.tags || transformed.tags.length === 0) ? <span className="text-sm text-gray-500">No tags</span> : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-gray-700 mr-1">Share:</span>
                      <a
                        href={fbHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-50 hover:bg-blue-100 rounded-lg transition text-blue-800 text-xs sm:text-sm font-semibold"
                        title="Share on Facebook"
                      >
                        <Facebook className="w-4 h-4" />
                        Facebook
                      </a>
                      <a
                        href={waHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-green-50 hover:bg-green-100 rounded-lg transition text-green-800 text-xs sm:text-sm font-semibold"
                        title="Share on WhatsApp"
                      >
                        <MessageCircle className="w-4 h-4" />
                        WhatsApp
                      </a>
                      <a
                        href={liHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-sky-50 hover:bg-sky-100 rounded-lg transition text-sky-800 text-xs sm:text-sm font-semibold"
                        title="Share on LinkedIn"
                      >
                        <Linkedin className="w-4 h-4" />
                        LinkedIn
                      </a>
                      <CopyLinkButton url={shareUrl} />
                    </div>
                  </div>

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

              {/* Sidebar - sticky, only blog content scrolls */}
              <aside className="lg:col-span-4 space-y-5 lg:sticky lg:top-24 lg:self-start">
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

                {/* Follow Us - in sidebar, not inside blog content */}
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="font-semibold text-gray-900 mb-3">Follow Us</div>
                  <div className="flex flex-wrap gap-3 text-sm">
                    <a
                      href={followFacebook || '#'}
                      target={followFacebook ? '_blank' : undefined}
                      rel={followFacebook ? 'noopener noreferrer' : undefined}
                      aria-disabled={!followFacebook}
                      className={`inline-flex items-center gap-2 ${followFacebook ? 'text-gray-700 hover:text-blue-600 hover:underline' : 'text-gray-400 cursor-not-allowed'}`}
                    >
                      <Facebook className="w-4 h-4" /> Facebook
                    </a>
                    <a
                      href={followInstagram || '#'}
                      target={followInstagram ? '_blank' : undefined}
                      rel={followInstagram ? 'noopener noreferrer' : undefined}
                      aria-disabled={!followInstagram}
                      className={`inline-flex items-center gap-2 ${followInstagram ? 'text-gray-700 hover:text-pink-600 hover:underline' : 'text-gray-400 cursor-not-allowed'}`}
                    >
                      <Instagram className="w-4 h-4" /> Instagram
                    </a>
                    <a
                      href={followYoutube || '#'}
                      target={followYoutube ? '_blank' : undefined}
                      rel={followYoutube ? 'noopener noreferrer' : undefined}
                      aria-disabled={!followYoutube}
                      className={`inline-flex items-center gap-2 ${followYoutube ? 'text-gray-700 hover:text-red-600 hover:underline' : 'text-gray-400 cursor-not-allowed'}`}
                    >
                      <Youtube className="w-4 h-4" /> YouTube
                    </a>
                    <a
                      href={followLinkedin || '#'}
                      target={followLinkedin ? '_blank' : undefined}
                      rel={followLinkedin ? 'noopener noreferrer' : undefined}
                      aria-disabled={!followLinkedin}
                      className={`inline-flex items-center gap-2 ${followLinkedin ? 'text-gray-700 hover:text-sky-600 hover:underline' : 'text-gray-400 cursor-not-allowed'}`}
                    >
                      <Linkedin className="w-4 h-4" /> LinkedIn
                    </a>
                  </div>
                </div>

                {/* Related Blog Articles - always in sidebar */}
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="font-semibold text-gray-900 mb-3">Related Blog Articles</div>
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
                    {(recentPosts || []).length === 0 ? <div className="text-sm text-gray-600">No related posts yet.</div> : null}
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

