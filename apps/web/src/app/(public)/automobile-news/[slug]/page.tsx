import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import JsonLd from '@/components/seo/JsonLd';
import { breadcrumbSchema } from '@/lib/seo/schemas';
import { buildPageMetadata, SITE_URL } from '@/lib/seo/metadata';
import { getAutomobileNewsArticle } from '@/lib/blog/automobileNews';
import { normalizeBlogContentForDisplay } from '@/lib/blog/normalizeBlogContent';
import { stripExistingCta } from '@/lib/blog/aiLinks';
import { stripMyFngServiceHtml } from '@/lib/blog/newsCarBlog';
import { PUBLIC_BLOG_AUTHOR, PUBLIC_BLOG_AUTHOR_HREF } from '@/lib/blog/publicAuthor';
import ViewCounter from '@/components/blog/ViewCounter';

export const revalidate = 120;

function storyDate(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = await getAutomobileNewsArticle(slug);
  if (!article) return {};
  return buildPageMetadata({
    title: `${article.title} | Automobile News | MYFNG`,
    description: article.excerpt || article.title,
    canonicalPath: `/automobile-news/${article.slug}`,
    keywords: ['automobile news', article.title, 'MYFNG'],
    keyphrase: 'automobile news',
    city: 'Mumbai',
    ogType: 'article',
  });
}

export default async function AutomobileNewsArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = await getAutomobileNewsArticle(slug);
  if (!article) notFound();

  const html = stripMyFngServiceHtml(
    stripExistingCta(normalizeBlogContentForDisplay(article.content)),
  );
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
            datePublished: article.publishedAt || undefined,
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
        <Link href="/automobile-news" className="text-xs font-bold uppercase tracking-[0.16em] text-[#0088E8]">
          Automobile News
        </Link>
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
          <div className="relative mt-6 aspect-[16/9] overflow-hidden bg-[#e8eef6]">
            <Image src={article.image} alt={article.title} fill className="object-cover" priority sizes="768px" />
          </div>
        ) : null}
        {article.excerpt ? <p className="mt-6 text-xl leading-8 text-[#243044]">{article.excerpt}</p> : null}
        <div
          className="news-body mt-6 text-base leading-8 text-[#1a1a1a]"
          dangerouslySetInnerHTML={{ __html: html }}
        />
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
