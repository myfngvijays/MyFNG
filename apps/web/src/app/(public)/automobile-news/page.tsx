import type { Metadata } from 'next';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import AutomobileNewsDesk from '@/components/blog/AutomobileNewsDesk';
import JsonLd from '@/components/seo/JsonLd';
import { breadcrumbSchema, collectionPageSchema } from '@/lib/seo/schemas';
import { buildManagedPageMetadata, getPageSeoForPath } from '@/lib/site-page-seo';
import { SITE_URL } from '@/lib/seo/metadata';
import { listAutomobileNews } from '@/lib/blog/automobileNews';
import { newsTopicFromStored } from '@/lib/blog/newsTopic';

export const dynamic = 'force-dynamic';

const PAGE_PATH = '/automobile-news';
const DESCRIPTION =
  'MYFNG Automobile News. Original stories on new cars, facelifts and launches for owners in Mumbai, Navi Mumbai, Thane, Palghar and Pune.';

function mastheadDate() {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());
}

export async function generateMetadata(): Promise<Metadata> {
  return buildManagedPageMetadata(PAGE_PATH);
}

export default async function AutomobileNewsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; topic?: string }>;
}) {
  const params = await searchParams;
  const news = await listAutomobileNews(1, 48);
  const managed = await getPageSeoForPath(PAGE_PATH);
  const description = managed?.description || DESCRIPTION;
  const pageUrl = `${SITE_URL}${PAGE_PATH}`;

  return (
    <div className="min-h-screen bg-white text-[#1a1a1a]">
      <JsonLd
        data={[
          collectionPageSchema({
            name: 'MYFNG Automobile News',
            description,
            url: pageUrl,
            items: news.items.map((item) => ({
              name: item.title,
              url: `${SITE_URL}/automobile-news/${item.slug}`,
            })),
          }),
          breadcrumbSchema([
            { name: 'Home', url: SITE_URL },
            { name: 'Automobile News', url: pageUrl },
          ]),
        ]}
      />
      <Navbar />

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-36 sm:pt-40">
        <header className="border-y-4 border-[#111] py-4 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#0088E8]">MYFNG Autocare</p>
          <h1 className="mt-1 text-4xl font-black tracking-tight text-[#111] sm:text-6xl">Automobile News</h1>
          <p className="mt-2 text-sm text-[#5c6778]">
            {mastheadDate()} · Mumbai · Navi Mumbai · Thane · Palghar · Pune
          </p>
        </header>

        {news.items.length === 0 ? (
          <section className="border-b border-[#111] py-16 text-center">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#0088E8]">The desk</p>
            <h2 className="mt-3 text-3xl font-black text-[#111]">No stories filed yet</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-[#5c6778]">
              New car and launch articles published under Automobile News appear on this page. Service guides stay on the blog.
            </p>
          </section>
        ) : (
          <AutomobileNewsDesk
            items={news.items}
            total={news.total}
            startExpanded={params.view === 'all'}
            initialTopic={newsTopicFromStored(params.topic)}
          />
        )}
      </main>
      <Footer hideCta />
    </div>
  );
}
