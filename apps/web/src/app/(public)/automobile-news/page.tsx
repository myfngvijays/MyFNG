import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import JsonLd from '@/components/seo/JsonLd';
import { breadcrumbSchema, collectionPageSchema } from '@/lib/seo/schemas';
import { buildPageMetadata, SITE_URL } from '@/lib/seo/metadata';
import { AUTOMOBILE_NEWS_PAGE_SIZE, listAutomobileNews, type AutomobileNewsItem } from '@/lib/blog/automobileNews';
import { PUBLIC_BLOG_AUTHOR, PUBLIC_BLOG_AUTHOR_HREF } from '@/lib/blog/publicAuthor';
import { formatNewsClock, formatNewsListingDate } from '@/lib/blog/newsClock';

export const dynamic = 'force-dynamic';

const PAGE_PATH = '/automobile-news';
const TITLE = 'Automobile News | New Cars & Launches | MYFNG';
const DESCRIPTION =
  'MYFNG Automobile News. Original stories on new cars, facelifts and launches for owners in Mumbai, Navi Mumbai, Thane, Palghar and Pune.';

function storyHref(slug: string) {
  return `/automobile-news/${slug}`;
}

function storyDate(value?: string | null) {
  return formatNewsListingDate(value);
}

function storyTime(value?: string | null) {
  return formatNewsClock(value);
}

function mastheadDate() {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());
}

function viewText(count: number) {
  const total = Number(count || 0);
  return `${total.toLocaleString('en-IN')} ${total === 1 ? 'view' : 'views'}`;
}

function pageNumbers(current: number, total: number) {
  const windowSize = 5;
  if (total <= windowSize) return Array.from({ length: total }, (_, index) => index + 1);
  const start = Math.min(Math.max(1, current - 2), total - windowSize + 1);
  return Array.from({ length: windowSize }, (_, index) => start + index);
}

function StoryByline({ item }: { item: AutomobileNewsItem }) {
  const views = viewText(item.views);
  return (
    <p className="text-sm text-[#5c6778]">
      By{' '}
      <Link href={PUBLIC_BLOG_AUTHOR_HREF} className="font-bold text-[#023D95] hover:underline">
        {PUBLIC_BLOG_AUTHOR}
      </Link>
      <span className="text-xs font-bold uppercase tracking-[0.14em] text-[#0088E8]">
        {` · ${item.category || 'Automobile News'}`}
        {item.publishedAt ? ` · ${storyDate(item.publishedAt)} · ${storyTime(item.publishedAt)}` : ''}
      </span>
      <span>{` · ${views}`}</span>
    </p>
  );
}

function StoryImage({
  item,
  priority = false,
  className = '',
  sizes = '(min-width: 1024px) 720px, 100vw',
}: {
  item: AutomobileNewsItem;
  priority?: boolean;
  className?: string;
  sizes?: string;
}) {
  if (!item.image) {
    return <div className={`absolute inset-0 bg-[#e8eef6] ${className}`} />;
  }
  return (
    <Image
      src={item.image}
      alt={item.title}
      fill
      priority={priority}
      className={`object-cover ${className}`}
      sizes={sizes}
    />
  );
}

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata({
    title: TITLE,
    description: DESCRIPTION,
    canonicalPath: PAGE_PATH,
    keywords: [
      'automobile news',
      'new car launches India',
      'car news Mumbai',
      'new cars Thane',
      'car news Pune',
      'latest automobile news',
      'MYFNG',
    ],
    keyphrase: 'automobile news',
    city: 'Mumbai',
  });
}

export default async function AutomobileNewsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const requestedPage = Math.max(1, Number(params.page || '1') || 1);
  const news = await listAutomobileNews(requestedPage);
  const totalPages = Math.max(1, Math.ceil(news.total / AUTOMOBILE_NEWS_PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const visible = page === news.page ? news : await listAutomobileNews(page);
  const pageUrl = `${SITE_URL}${PAGE_PATH}`;
  const [lead, ...rest] = visible.items;
  const rail = page === 1 ? rest.slice(0, 4) : [];
  const more = page === 1 ? rest.slice(4) : visible.items;

  return (
    <div className="min-h-screen bg-white text-[#1a1a1a]">
      <JsonLd
        data={[
          collectionPageSchema({
            name: 'MYFNG Automobile News',
            description: DESCRIPTION,
            url: pageUrl,
            items: visible.items.map((item) => ({
              name: item.title,
              url: `${SITE_URL}${storyHref(item.slug)}`,
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
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#0088E8]">MYFNG</p>
          <h1 className="mt-1 text-4xl font-black tracking-tight text-[#111] sm:text-6xl">Automobile News</h1>
          <p className="mt-2 text-sm text-[#5c6778]">
            {mastheadDate()} · Mumbai · Navi Mumbai · Thane · Palghar · Pune
          </p>
        </header>

        {visible.items.length === 0 ? (
          <section className="border-b border-[#111] py-16 text-center">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#0088E8]">The desk</p>
            <h2 className="mt-3 text-3xl font-black text-[#111]">No stories filed yet</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-[#5c6778]">
              New car and launch articles published under Automobile News appear on this page. Service guides stay on the blog.
            </p>
          </section>
        ) : (
          <>
            {lead && page === 1 ? (
              <section className="grid items-stretch gap-8 border-b border-[#d7d7d7] py-8 lg:grid-cols-[1.4fr_.8fr]">
                <article>
                  {lead.image ? (
                    <Link href={storyHref(lead.slug)} className="relative block aspect-[16/9] overflow-hidden bg-[#e8eef6]">
                      <StoryImage item={lead} priority />
                    </Link>
                  ) : null}
                  <div className="mt-4">
                    <StoryByline item={lead} />
                  </div>
                  <h2 className="mt-2 text-3xl font-black leading-tight text-[#111] sm:text-4xl">
                    <Link href={storyHref(lead.slug)}>{lead.title}</Link>
                  </h2>
                  {lead.excerpt ? <p className="mt-3 text-base leading-7 text-[#3d4a5c]">{lead.excerpt}</p> : null}
                  <Link href={storyHref(lead.slug)} className="mt-4 inline-flex text-sm font-bold uppercase tracking-wide text-[#023D95]">
                    Read the story
                  </Link>
                </article>

                {rail.length > 0 ? (
                  <aside className="flex flex-col">
                    <h2 className="border-b-2 border-[#111] pb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#111]">Latest</h2>
                    <ol className="mt-1 flex flex-1 flex-col">
                      {rail.map((item, index) => (
                        <li key={item.id} className="flex flex-1 items-center border-b border-[#e6e6e6] py-3">
                          <Link href={storyHref(item.slug)} className="group grid w-full grid-cols-[96px_1fr] items-center gap-3">
                            {item.image ? (
                              <div className="relative aspect-[4/3] overflow-hidden bg-[#e8eef6]">
                                <StoryImage item={item} sizes="96px" />
                              </div>
                            ) : <span />}
                            <div>
                              <p className="text-xs font-bold text-[#0088E8]">
                                {String(index + 1).padStart(2, '0')} · {PUBLIC_BLOG_AUTHOR}
                                {item.publishedAt ? ` · ${storyTime(item.publishedAt)}` : ''}
                                {` · ${viewText(item.views)}`}
                              </p>
                              <h3 className="mt-1 text-base font-bold leading-snug text-[#111] group-hover:text-[#023D95]">
                                {item.title}
                              </h3>
                            </div>
                          </Link>
                        </li>
                      ))}
                    </ol>
                  </aside>
                ) : null}
              </section>
            ) : null}

            {more.length > 0 ? (
              <section className="py-8">
                <h2 className="border-b-2 border-[#111] pb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#111]">
                  {page === 1 ? 'More stories' : `Stories · page ${page}`}
                </h2>
                <div className="mt-2 divide-y divide-[#e6e6e6]">
                  {more.map((item) => (
                    <article key={item.id} className={`grid gap-4 py-5 ${item.image ? 'sm:grid-cols-[180px_1fr]' : ''}`}>
                      {item.image ? (
                        <Link href={storyHref(item.slug)} className="relative block aspect-[16/10] overflow-hidden bg-[#e8eef6]">
                          <StoryImage item={item} />
                        </Link>
                      ) : null}
                      <div>
                        <StoryByline item={item} />
                        <h3 className="mt-1 text-2xl font-black leading-tight text-[#111]">
                          <Link href={storyHref(item.slug)}>{item.title}</Link>
                        </h3>
                        {item.excerpt ? <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#3d4a5c]">{item.excerpt}</p> : null}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}
          </>
        )}

        {visible.items.length > 0 ? (
          <nav className="mt-10 flex justify-center" aria-label="Stories pages">
            <div className="inline-flex max-w-full items-center gap-1 rounded-full bg-[#111] p-1.5 text-white">
              {page > 1 ? (
                <Link href={page === 2 ? PAGE_PATH : `${PAGE_PATH}?page=${page - 1}`} className="inline-flex h-11 items-center gap-2 rounded-full px-4 text-xs font-bold uppercase tracking-[0.16em] hover:bg-white/10">
                  <span aria-hidden="true">←</span> Newer
                </Link>
              ) : (
                <span className="inline-flex h-11 items-center gap-2 rounded-full px-4 text-xs font-bold uppercase tracking-[0.16em] text-white/30">
                  <span aria-hidden="true">←</span> Newer
                </span>
              )}
              <ol className="flex items-center gap-1">
                {pageNumbers(page, totalPages).map((number) => {
                  const active = number === page;
                  return (
                    <li key={number}>
                      <Link
                        href={number === 1 ? PAGE_PATH : `${PAGE_PATH}?page=${number}`}
                        aria-current={active ? 'page' : undefined}
                        className={`flex h-11 min-w-11 items-center justify-center rounded-full px-3 text-sm font-black tabular-nums ${
                          active ? 'bg-[#0088E8] text-white' : 'text-white/75 hover:bg-white/10'
                        }`}
                      >
                        {String(number).padStart(2, '0')}
                      </Link>
                    </li>
                  );
                })}
              </ol>
              {page < totalPages ? (
                <Link href={`${PAGE_PATH}?page=${page + 1}`} className="inline-flex h-11 items-center gap-2 rounded-full px-4 text-xs font-bold uppercase tracking-[0.16em] hover:bg-white/10">
                  Older <span aria-hidden="true">→</span>
                </Link>
              ) : (
                <span className="inline-flex h-11 items-center gap-2 rounded-full px-4 text-xs font-bold uppercase tracking-[0.16em] text-white/30">
                  Older <span aria-hidden="true">→</span>
                </span>
              )}
            </div>
          </nav>
        ) : null}
      </main>
      <Footer hideCta />
    </div>
  );
}
