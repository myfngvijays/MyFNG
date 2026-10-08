import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import JsonLd from '@/components/seo/JsonLd';
import { breadcrumbSchema } from '@/lib/seo/schemas';
import { parseBlogSeoData } from '@/lib/blog/seo';
import { normalizeBlogMediaAbsoluteUrl } from '@/lib/blog/normalizeBlogMedia';
import { buildPageMetadata, SITE_URL } from '@/lib/seo/metadata';
import { getAutomobileNewsArticle, listAutomobileNews, listMyfngBlogsForNews, pickRelatedNews } from '@/lib/blog/automobileNews';
import { formatNewsArticleWhen, formatNewsClock, formatNewsListingDate, newsDatePublishedIso } from '@/lib/blog/newsClock';
import { normalizeBlogContentForDisplay } from '@/lib/blog/normalizeBlogContent';
import { stripExistingCta } from '@/lib/blog/aiLinks';
import { stripMyFngServiceHtml } from '@/lib/blog/newsCarBlog';
import { PUBLIC_BLOG_AUTHOR, PUBLIC_BLOG_AUTHOR_HREF } from '@/lib/blog/publicAuthor';
import ViewCounter from '@/components/blog/ViewCounter';

export const revalidate = 120;

function storyDate(value?: string | null) {
  return formatNewsArticleWhen(value);
}

function dropDuplicateLeadPhoto(html: string, featured?: string | null) {
  const match = String(html || '').match(/^\s*<figure\b[\s\S]*?<\/figure>\s*/i);
  if (!match || !featured) return { html, caption: '' };
  const src = match[0].match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i)?.[1] || '';
  const featuredPath = featured.split('?')[0];
  const same = src && (src.split('?')[0] === featuredPath || src.includes(featuredPath) || featuredPath.includes(src.split('?')[0]));
  if (!same) return { html, caption: '' };
  const caption = match[0]
    .match(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/i)?.[1]
    ?.replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || '';
  return { html: html.slice(match[0].length), caption };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = await getAutomobileNewsArticle(slug);
  if (!article) return {};
  const seo = parseBlogSeoData(article.seo);
  const title = String(seo.meta_title || article.title).trim();
  const description = String(seo.meta_description || article.excerpt || article.title).trim();
  const keywords = String(seo.keywords || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const canonical = String(seo.canonical_url || `${SITE_URL}/automobile-news/${article.slug}`).trim();
  const ogTitle = String(seo.og_title || title).trim();
  const ogDesc = String(seo.og_description || description).trim();
  const ogImage = normalizeBlogMediaAbsoluteUrl(String(seo.og_image || article.image || '').trim()) || undefined;
  const keyphrase = String(seo.keyphrase || keywords[0] || 'automobile news').trim();
  const areas = Array.isArray(seo.local_areas) ? seo.local_areas.filter(Boolean) : [];
  return {
    ...buildPageMetadata({
      title,
      description,
      canonicalPath: `/automobile-news/${article.slug}`,
      keywords: keywords.length ? keywords : ['automobile news', article.title, 'MYFNG'],
      keyphrase,
      city: String(seo.local_city || 'Mumbai'),
      ogType: 'article',
      ogImage,
      noindex: seo.robots_index === false,
    }),
    alternates: { canonical },
    robots: {
      index: seo.robots_index !== false,
      follow: seo.robots_follow !== false,
    },
    openGraph: {
      type: 'article',
      title: ogTitle,
      description: ogDesc || undefined,
      url: canonical,
      siteName: 'MYFNG',
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
      ...(keyphrase ? { keyphrase } : {}),
      ...(areas.length ? { 'local-areas': areas.join(', ') } : {}),
      author: PUBLIC_BLOG_AUTHOR,
    },
  };
}

export default async function AutomobileNewsArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = await getAutomobileNewsArticle(slug);
  if (!article) notFound();
  const [myfngBlogs, news] = await Promise.all([
    listMyfngBlogsForNews(article.slug),
    listAutomobileNews(1, 24),
  ]);
  const related = pickRelatedNews(news.items, article.slug, article.topic, 3);

  const prepared = dropDuplicateLeadPhoto(
    stripMyFngServiceHtml(stripExistingCta(normalizeBlogContentForDisplay(article.content))),
    article.image,
  );
  const html = prepared.html;
  const photoCaption = article.photoCaption || prepared.caption;
  const pageUrl = `${SITE_URL}/automobile-news/${article.slug}`;

  return (
    <div className="min-h-screen bg-white text-[#1a1a1a]">
      <JsonLd
        data={[
          {
            '@context': 'https://schema.org',
            '@type': 'NewsArticle',
            headline: article.title,
            description: article.excerpt || undefined,
            datePublished: newsDatePublishedIso(article.publishedAt),
            image: article.image ? `${SITE_URL}${article.image}` : undefined,
            mainEntityOfPage: pageUrl,
            author: {
              '@type': 'Person',
              name: PUBLIC_BLOG_AUTHOR,
              url: `${SITE_URL}${PUBLIC_BLOG_AUTHOR_HREF}`,
            },
            publisher: { '@type': 'Organization', name: 'MYFNG', url: SITE_URL },
          },
          breadcrumbSchema([
            { name: 'Home', url: SITE_URL },
            { name: 'Automobile News', url: `${SITE_URL}/automobile-news` },
            { name: article.title, url: pageUrl },
          ]),
        ]}
      />
      <Navbar />
      <article className="mx-auto max-w-3xl px-4 pb-16 pt-36 sm:pt-40">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Link href="/automobile-news" className="text-xs font-bold uppercase tracking-[0.16em] text-[#0088E8]">
            Automobile News
          </Link>
          <Link href={`/automobile-news?topic=${article.topic}`} className="text-xs font-bold uppercase tracking-[0.16em] text-[#111] hover:text-[#023D95]">
            {article.topic}
          </Link>
        </div>
        <h1 className="mt-3 text-3xl font-black leading-tight text-[#111] sm:text-5xl">{article.title}</h1>
        <p className="mt-4 border-y border-[#e6e6e6] py-3 text-sm text-[#5c6778]">
          By{' '}
          <Link href={PUBLIC_BLOG_AUTHOR_HREF} className="font-bold text-[#023D95]">
            {PUBLIC_BLOG_AUTHOR}
          </Link>
          {article.publishedAt ? ` · ${storyDate(article.publishedAt)}` : ''}
          {` · ${article.readTime} min read · `}
          <ViewCounter slug={article.slug} initialViews={article.views} withLabel />
        </p>
        {article.image ? (
          <figure className="mt-6">
            <div className="relative aspect-[16/9] overflow-hidden bg-[#e8eef6]">
              <Image src={article.image} alt={article.title} fill className="object-cover" priority sizes="768px" />
            </div>
            {photoCaption ? <figcaption className="mt-2 text-xs leading-5 text-[#5c6778]">{photoCaption}</figcaption> : null}
          </figure>
        ) : null}
        {article.excerpt ? <p className="mt-6 text-xl italic leading-8 text-[#243044]">{article.excerpt}</p> : null}
        <div
          className="news-body mt-6 text-base leading-8 text-[#1a1a1a]"
          dangerouslySetInnerHTML={{ __html: html }}
        />
        {related.length ? (
          <aside className="mt-10 border-t border-[#111] pt-5">
            <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-[#111]">More automobile news</h2>
            <ul className="mt-4 border-y border-[#e6e6e6]">
              {related.map((item) => (
                <li key={item.id} className="border-b border-[#e6e6e6] last:border-b-0">
                  <Link href={`/automobile-news/${item.slug}`} className="group grid grid-cols-[96px_1fr] items-center gap-3 py-3">
                    <div className="relative aspect-[4/3] overflow-hidden bg-[#e8eef6]">
                      {item.image ? (
                        <Image src={item.image} alt={item.title} fill className="object-cover" sizes="96px" />
                      ) : null}
                    </div>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wide text-[#0088E8]">
                        {item.topic}
                        {item.publishedAt ? ` · ${formatNewsListingDate(item.publishedAt)} · ${formatNewsClock(item.publishedAt)}` : ''}
                      </p>
                      <p className="mt-1 text-base font-bold leading-snug text-[#111] group-hover:text-[#023D95]">{item.title}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </aside>
        ) : null}
        {myfngBlogs.length ? (
          <aside className="mt-10 border-t border-[#111] pt-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#0088E8]">From the MyFNG blog</p>
            <p className="mt-2 text-base leading-7 text-[#243044]">
              Read the MyFNG car-care guides for owners in Mumbai, Navi Mumbai, Thane, Palghar and Pune.
            </p>
            <ul className="mt-3 space-y-2">
              {myfngBlogs.map((blog) => (
                <li key={blog.slug}>
                  <Link href={`/blogs/${blog.slug}`} className="font-semibold text-[#023D95] hover:underline">
                    {blog.title}
                  </Link>
                </li>
              ))}
            </ul>
            <Link href="/blogs" className="mt-4 inline-block text-sm font-bold uppercase tracking-[0.12em] text-[#0088E8]">
              All MyFNG blogs
            </Link>
          </aside>
        ) : null}
        <style>{`
          .news-body h2, .news-body h3 { color: #111; font-weight: 800; margin: 1.4rem 0 .6rem; }
          .news-body p { margin: .8rem 0; }
          .news-body ul, .news-body ol { margin: .8rem 0 .8rem 1.2rem; }
          .news-body a { color: #023D95; font-weight: 600; }
          .news-body img { width: 100%; height: auto; margin: 1rem 0; }
          .news-body table { width: 100%; border-collapse: collapse; margin: 1rem 0; font-size: 14px; }
          .news-body th, .news-body td { border-bottom: 1px solid #e6e6e6; text-align: left; padding: 8px 6px; }
          .news-body th { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; }
        `}</style>
      </article>
      <Footer hideCta />
    </div>
  );
}
