'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { AutomobileNewsItem } from '@/lib/blog/automobileNews';
import { PUBLIC_BLOG_AUTHOR, PUBLIC_BLOG_AUTHOR_HREF } from '@/lib/blog/publicAuthor';
import { formatNewsClock, formatNewsListingDate } from '@/lib/blog/newsClock';
import { NEWS_TOPICS, type NewsTopic } from '@/lib/blog/newsTopic';

const PREVIEW_COUNT = 6;
const LATEST_COUNT = 4;

function storyHref(slug: string) {
  return `/automobile-news/${slug}`;
}

function viewText(count: number) {
  const total = Number(count || 0);
  return `${total.toLocaleString('en-IN')} ${total === 1 ? 'view' : 'views'}`;
}

function matchesQuery(item: AutomobileNewsItem, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return `${item.topic} ${item.title} ${item.excerpt}`.toLowerCase().includes(needle);
}

function storyMeta(item: AutomobileNewsItem, withDate: boolean) {
  const when = item.publishedAt
    ? withDate
      ? `${formatNewsListingDate(item.publishedAt)} · ${formatNewsClock(item.publishedAt)}`
      : formatNewsClock(item.publishedAt)
    : '';
  return [item.topic, when, viewText(item.views)].filter(Boolean).join(' · ');
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
  if (!item.image) return <div className={`absolute inset-0 bg-[#e8eef6] ${className}`} />;
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

function StoryCard({ item }: { item: AutomobileNewsItem }) {
  return (
    <article className="flex flex-col border border-[#e6e6e6] bg-white">
      <Link href={storyHref(item.slug)} className="group relative block aspect-[16/10] overflow-hidden bg-[#e8eef6]">
        <StoryImage item={item} className="transition duration-500 group-hover:scale-[1.03]" />
      </Link>
      <div className="flex flex-1 flex-col p-4">
        <p className="text-[11px] font-bold uppercase tracking-wide text-[#0088E8]">
          {storyMeta(item, true)}
        </p>
        <h3 className="mt-2 text-lg font-black leading-snug text-[#111]">
          <Link href={storyHref(item.slug)} className="hover:text-[#023D95]">{item.title}</Link>
        </h3>
        {item.excerpt ? <p className="mt-2 line-clamp-3 text-sm leading-6 text-[#3d4a5c]">{item.excerpt}</p> : null}
      </div>
    </article>
  );
}

function TopicMenu({
  topics,
  active,
  onSelect,
}: {
  topics: NewsTopic[];
  active: NewsTopic | 'All';
  onSelect: (topic: NewsTopic | 'All') => void;
}) {
  const entries: Array<NewsTopic | 'All'> = ['All', ...topics];
  return (
    <nav aria-label="News topics" className="flex flex-wrap items-center justify-center gap-x-1 border-b border-[#d7d7d7] py-3">
      {entries.map((entry) => {
        const selected = entry === active;
        return (
          <button
            key={entry}
            type="button"
            onClick={() => onSelect(entry)}
            aria-current={selected ? 'page' : undefined}
            className={`px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] ${
              selected ? 'text-[#023D95] underline decoration-2 underline-offset-8' : 'text-[#5c6778] hover:text-[#111]'
            }`}
          >
            {entry}
          </button>
        );
      })}
    </nav>
  );
}

export default function AutomobileNewsDesk({
  items,
  total,
  startExpanded = false,
  initialTopic = null,
}: {
  items: AutomobileNewsItem[];
  total: number;
  startExpanded?: boolean;
  initialTopic?: NewsTopic | null;
}) {
  const [query, setQuery] = useState('');
  const [topic, setTopic] = useState<NewsTopic | 'All'>(initialTopic ?? 'All');
  const [expanded, setExpanded] = useState(startExpanded);
  const [page, setPage] = useState(1);
  const moreRef = useRef<HTMLElement>(null);
  const searching = query.trim().length > 0;
  const topics = [...NEWS_TOPICS];
  const scoped = useMemo(
    () => (topic === 'All' ? items : items.filter((item) => item.topic === topic)),
    [items, topic],
  );
  const lead = scoped[0];
  const pool = useMemo(
    () => scoped.filter((item) => item.id !== lead?.id && matchesQuery(item, query)),
    [scoped, lead?.id, query],
  );
  const latest = pool.slice(0, LATEST_COUNT);
  const morePool = pool.slice(LATEST_COUNT);
  const pageCount = Math.max(1, Math.ceil(morePool.length / PREVIEW_COUNT));
  const currentPage = Math.min(page, pageCount);
  const pageStart = (currentPage - 1) * PREVIEW_COUNT;
  const visibleMore = expanded ? morePool : morePool.slice(pageStart, pageStart + PREVIEW_COUNT);

  useEffect(() => {
    setPage(1);
  }, [query, topic]);

  function selectTopic(next: NewsTopic | 'All') {
    setTopic(next);
    setExpanded(false);
    const url = new URL(window.location.href);
    if (next === 'All') url.searchParams.delete('topic');
    else url.searchParams.set('topic', next);
    window.history.replaceState(null, '', `${url.pathname}${url.search}`);
  }

  function goToPage(next: number) {
    setExpanded(false);
    setPage(next);
    moreRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const storyCount = topic === 'All' ? total : scoped.length;

  return (
    <>
      <TopicMenu topics={topics} active={topic} onSelect={selectTopic} />
      {!lead ? (
        <p className="py-16 text-center text-sm text-[#5c6778]">No stories in {topic}.</p>
      ) : (
      <>
      <section className="grid items-stretch gap-8 py-8 lg:grid-cols-[1.35fr_.85fr]">
        <article>
          <Link href={storyHref(lead.slug)} className="group relative block aspect-[16/10] overflow-hidden bg-[#e8eef6]">
            <StoryImage item={lead} priority className="transition duration-500 group-hover:scale-[1.03]" />
            <span className="absolute left-3 top-3 bg-[#111] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white">
              Lead story
            </span>
          </Link>
          <div className="mt-4 border-l-4 border-[#0088E8] pl-4">
            <p className="text-xs text-[#5c6778]">
              By{' '}
              <Link href={PUBLIC_BLOG_AUTHOR_HREF} className="font-bold text-[#023D95] hover:underline">
                {PUBLIC_BLOG_AUTHOR}
              </Link>
              <span className="font-bold uppercase tracking-[0.12em] text-[#0088E8]">
                {` · ${lead.topic}`}
                {lead.publishedAt ? ` · ${formatNewsListingDate(lead.publishedAt)} · ${formatNewsClock(lead.publishedAt)}` : ''}
              </span>
              <span>{` · ${viewText(lead.views)}`}</span>
            </p>
            <h2 className="mt-2 text-2xl font-black leading-tight text-[#111]">
              <Link href={storyHref(lead.slug)} className="hover:text-[#023D95]">{lead.title}</Link>
            </h2>
            {lead.excerpt ? <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#3d4a5c]">{lead.excerpt}</p> : null}
            <Link href={storyHref(lead.slug)} className="mt-3 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-[#023D95] hover:underline">
              Read the story <span aria-hidden="true">→</span>
            </Link>
          </div>
        </article>

        <aside className="flex h-full flex-col bg-[#f6f8fb] p-4 sm:p-5">
          <form onSubmit={(event) => event.preventDefault()}>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-[#111]">Search stories</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Car, brand or headline"
                className="mt-2 w-full border border-[#d5dbe3] bg-white px-3 py-2.5 text-sm text-[#111] outline-none placeholder:text-[#8b95a3] focus:border-[#023D95]"
              />
            </label>
          </form>
          <h2 className="mt-5 border-b-2 border-[#111] pb-2 text-sm font-black tracking-tight text-[#111]">Latest articles</h2>
          {latest.length === 0 ? (
            <p className="py-4 text-sm text-[#5c6778]">No matching stories.</p>
          ) : (
            <ol className="flex flex-1 flex-col">
              {latest.map((item, index) => (
                <li key={item.id} className="flex flex-1 border-b border-[#e1e6ee] last:border-b-0">
                  <Link href={storyHref(item.slug)} className="group grid w-full grid-cols-[88px_1fr] items-center gap-3 py-3">
                    <div className="relative aspect-[4/3] overflow-hidden bg-[#e8eef6]">
                      <StoryImage item={item} sizes="88px" className="transition duration-500 group-hover:scale-105" />
                      <span className="absolute left-1 top-1 bg-white/95 px-1.5 text-[10px] font-black tabular-nums text-[#023D95]">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wide text-[#0088E8]">
                        {storyMeta(item, false)}
                      </p>
                      <h3 className="mt-1 text-[15px] font-bold leading-snug text-[#111] group-hover:text-[#023D95]">
                        {item.title}
                      </h3>
                    </div>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </aside>
      </section>

      <section ref={moreRef} className="scroll-mt-28 border-t border-[#d7d7d7] py-8">
        <div className="flex items-end justify-between gap-4 border-b-2 border-[#111] pb-2">
          <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-[#111]">
            {searching ? 'Search results' : 'More stories'}
          </h2>
          <div className="flex items-center gap-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#5c6778]">
              {storyCount.toLocaleString('en-IN')} stories
            </p>
            {!expanded && pageCount > 1 ? (
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#023D95] hover:underline"
              >
                View all
              </button>
            ) : null}
            {expanded && pageCount > 1 ? (
              <button
                type="button"
                onClick={() => goToPage(1)}
                className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#023D95] hover:underline"
              >
                Show less
              </button>
            ) : null}
          </div>
        </div>
        {visibleMore.length === 0 ? (
          <p className="py-8 text-sm text-[#5c6778]">No matching stories.</p>
        ) : (
          <div key={expanded ? 'all' : currentPage} className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {visibleMore.map((item, index) => (
              <div
                key={item.id}
                style={{ animation: 'fadeInUp 0.45s ease-out both', animationDelay: `${index * 45}ms` }}
              >
                <StoryCard item={item} />
              </div>
            ))}
          </div>
        )}
        {!expanded && pageCount > 1 ? (
          <nav className="mt-10 flex flex-col items-center gap-3" aria-label="More stories pages">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
                aria-label="Previous page"
                className="flex h-11 w-11 items-center justify-center rounded-full border border-[#d5dbe3] bg-white text-lg text-[#111] transition duration-200 hover:-translate-x-0.5 hover:border-[#023D95] hover:text-[#023D95] disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:translate-x-0 disabled:hover:border-[#d5dbe3] disabled:hover:text-[#111]"
              >
                <span aria-hidden="true">←</span>
              </button>
              <div className="relative inline-flex rounded-full bg-[#eef2f7] p-1">
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1 left-1 h-10 w-10 rounded-full bg-[#023D95] shadow-[0_8px_18px_rgba(2,61,149,0.35)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
                  style={{ transform: `translateX(${(currentPage - 1) * 40}px)` }}
                />
                {Array.from({ length: pageCount }, (_, index) => index + 1).map((number) => (
                  <button
                    key={number}
                    type="button"
                    onClick={() => goToPage(number)}
                    aria-current={number === currentPage ? 'page' : undefined}
                    className={`relative z-10 h-10 w-10 rounded-full text-sm font-bold transition-colors duration-300 ${
                      number === currentPage ? 'text-white' : 'text-[#334155] hover:text-[#023D95]'
                    }`}
                  >
                    {number}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === pageCount}
                aria-label="Next page"
                className="flex h-11 w-11 items-center justify-center rounded-full border border-[#d5dbe3] bg-white text-lg text-[#111] transition duration-200 hover:translate-x-0.5 hover:border-[#023D95] hover:text-[#023D95] disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:translate-x-0 disabled:hover:border-[#d5dbe3] disabled:hover:text-[#111]"
              >
                <span aria-hidden="true">→</span>
              </button>
            </div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#5c6778]">
              Page {currentPage} of {pageCount}
            </p>
          </nav>
        ) : null}
      </section>
      </>
      )}
    </>
  );
}
