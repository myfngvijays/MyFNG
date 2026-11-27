'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { Calendar, ChevronLeft, ChevronRight, Eye, Search, X } from 'lucide-react';
import { normalizeBlogMediaUrl } from '@/lib/blog/normalizeBlogMedia';

const BLOGS_PER_PAGE = 9;
const NAVY = '#023D95';

function kolkataDateKey(dateString?: string) {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function formatBlogDate(dateString?: string) {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', {
    timeZone: 'Asia/Kolkata',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function shiftMonth(monthKey: string, delta: number) {
  const [year, month] = monthKey.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthCells(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number);
  const first = new Date(`${monthKey}-01T12:00:00+05:30`);
  const pad = first.getDay();
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: Array<string | null> = Array.from({ length: pad }, () => null);
  for (let day = 1; day <= days; day += 1) {
    cells.push(`${monthKey}-${String(day).padStart(2, '0')}`);
  }
  return cells;
}

function monthLabel(monthKey: string) {
  return new Date(`${monthKey}-01T12:00:00+05:30`).toLocaleDateString('en-US', {
    timeZone: 'Asia/Kolkata',
    month: 'long',
    year: 'numeric',
  });
}

function getVisiblePageNumbers(currentPage: number, totalPages: number, maxVisible = 5): number[] {
  if (totalPages <= maxVisible) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  if (currentPage <= 3) {
    return Array.from({ length: maxVisible }, (_, i) => i + 1);
  }
  if (currentPage >= totalPages - 2) {
    return Array.from({ length: maxVisible }, (_, i) => totalPages - maxVisible + i + 1);
  }
  return Array.from({ length: maxVisible }, (_, i) => currentPage - 2 + i);
}

interface Blog {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  status: string;
  views: number;
  read_time: number;
  created_at: string;
  published_at?: string;
  featured_image?: string;
  category?: { id: string; name: string; slug: string };
  tags?: Array<{ name: string; slug: string }>;
  author?: { full_name: string };
}

export default function BlogPageClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string; slug: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState('');
  const [dateOpen, setDateOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState('');
  const datePickerRef = useRef<HTMLDivElement>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalUiPages, setTotalUiPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [calendarCounts, setCalendarCounts] = useState<Record<string, number>>({});
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchGen = useRef(0);
  const calendarLoadedRef = useRef(false);

  useEffect(() => {
    void fetch('/api/blogs/categories')
      .then((r) => r.json())
      .then((j) => {
        const rows = Array.isArray(j?.categories) ? j.categories : [];
        setCategories(rows.map((c: any) => ({ id: c.id, name: c.name, slug: c.slug })));
      })
      .catch(() => setCategories([]));
  }, []);

  function updateUrl(next: { q?: string; category?: string; date?: string; page?: number }) {
    const params = new URLSearchParams();
    const q = (next.q ?? '').trim();
    const cat = (next.category ?? '').trim();
    const date = (next.date ?? '').trim();
    const page = Number(next.page ?? 1);
    if (q) params.set('q', q);
    if (cat && cat !== 'all') params.set('category', cat);
    if (date) params.set('date', date);
    if (page > 1) params.set('page', String(page));
    const qs = params.toString();
    router.replace(qs ? `/blogs?${qs}` : '/blogs');
  }

  function uiPageToOffset(uiPage: number) {
    if (uiPage <= 1) return { offset: 0, limit: BLOGS_PER_PAGE + 1 };
    return { offset: BLOGS_PER_PAGE + 1 + (uiPage - 2) * BLOGS_PER_PAGE, limit: BLOGS_PER_PAGE };
  }

  function totalUiPagesFromCount(total: number) {
    if (total <= 0) return 1;
    if (total <= BLOGS_PER_PAGE + 1) return 1;
    return 1 + Math.ceil((total - (BLOGS_PER_PAGE + 1)) / BLOGS_PER_PAGE);
  }

  async function fetchBlogPage(opts: {
    q: string;
    category: string;
    date: string;
    page: number;
  }) {
    const generation = fetchGen.current + 1;
    fetchGen.current = generation;
    setLoading(true);
    try {
      const { offset, limit } = uiPageToOffset(opts.page);
      const params = new URLSearchParams();
      params.set('offset', String(offset));
      params.set('limit', String(limit));
      if (opts.q) params.set('search', opts.q);
      if (opts.category && opts.category !== 'all') params.set('category_id', opts.category);
      if (opts.date) params.set('date', opts.date);

      const response = await fetch(`/api/blogs/public?${params.toString()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('Failed to fetch blogs');
      const data = await response.json();
      if (fetchGen.current !== generation) return;

      const rows = (data.blogs || []) as Blog[];
      const total = Number(data?.pagination?.total ?? rows.length);
      setBlogs(rows);
      setTotalCount(total);
      setTotalUiPages(totalUiPagesFromCount(total));
    } catch (error) {
      if (fetchGen.current !== generation) return;
      console.error('Error fetching blogs:', error);
      setBlogs([]);
      setTotalCount(0);
      setTotalUiPages(1);
    } finally {
      if (fetchGen.current === generation) setLoading(false);
    }
  }

  useEffect(() => {
    if (!dateOpen) return;
    function onPointer(event: MouseEvent) {
      if (!datePickerRef.current?.contains(event.target as Node)) setDateOpen(false);
    }
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, [dateOpen]);

  const postCountByDate = useMemo(
    () => new Map(Object.entries(calendarCounts)),
    [calendarCounts],
  );

  function applyDate(nextDate: string) {
    setSelectedDate(nextDate);
    setCurrentPage(1);
    setDateOpen(false);
    updateUrl({ q: searchQuery, category: selectedCategory, date: nextDate, page: 1 });
  }

  const featured = currentPage === 1 && blogs.length > 0 ? blogs[0] : null;
  const gridPosts = currentPage === 1 ? blogs.slice(1) : blogs;
  const totalPages = totalUiPages;

  useEffect(() => {
    const q = (searchParams.get('q') || '').trim();
    const category = (searchParams.get('category') || '').trim();
    const date = (searchParams.get('date') || '').trim();
    const page = Math.max(1, Number(searchParams.get('page') || '1'));
    setSearchQuery(q);
    setSelectedCategory(category || 'all');
    setSelectedDate(/^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '');
    setCurrentPage(page);
    void fetchBlogPage({ q, category: category || 'all', date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '', page });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    if (!dateOpen || calendarLoadedRef.current) return;
    calendarLoadedRef.current = true;
    void fetch('/api/blogs/public?calendar=1')
      .then((r) => r.json())
      .then((j) => setCalendarCounts((j?.counts || {}) as Record<string, number>))
      .catch(() => setCalendarCounts({}));
  }, [dateOpen]);

  function clearAllFilters() {
    setSearchQuery('');
    setSelectedCategory('all');
    setSelectedDate('');
    setCurrentPage(1);
    setDateOpen(false);
    router.push('/blogs');
  }

  const hasActiveFilters =
    Boolean(searchQuery.trim()) || selectedCategory !== 'all' || Boolean(selectedDate);

  useEffect(() => {
    if (currentPage > totalPages && totalPages >= 1) {
      updateUrl({ q: searchQuery, category: selectedCategory, date: selectedDate, page: totalPages });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalPages, currentPage]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    updateUrl({ q: searchQuery, category: selectedCategory, date: selectedDate, page });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const formatDate = formatBlogDate;

  const cover = (blog: Blog, className: string, contain = false) => {
    const src = blog.featured_image
      ? normalizeBlogMediaUrl(blog.featured_image) || blog.featured_image
      : '';
    return (
      <div className={`relative overflow-hidden bg-gray-200 ${className}`}>
        {src ? (
          contain ? (
            <>
              {/* Box is 16:9 like the covers, so the full image fits with no blurred bands */}
              <Image src={src} alt={blog.title} fill priority className="object-contain" />
            </>
          ) : (
            <Image src={src} alt={blog.title} fill className="object-cover" />
          )
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-brand-primary to-blue-600">
            <span className="text-4xl font-bold text-white">{blog.title.charAt(0).toUpperCase()}</span>
          </div>
        )}
        {blog.category?.name ? (
          <span className="absolute left-4 top-4 rounded-full bg-brand-primary px-3 py-1 text-xs font-semibold text-white">
            {blog.category.name}
          </span>
        ) : null}
      </div>
    );
  };

  const meta = (blog: Blog) => (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
      <span className="font-medium text-gray-700">{blog.author?.full_name || 'MyFNG'}</span>
      {blog.published_at ? (
        <span className="inline-flex items-center gap-1">
          <Calendar className="h-3.5 w-3.5" />
          {formatDate(blog.published_at)}
        </span>
      ) : null}
      <span className="inline-flex items-center gap-1">
        <Eye className="h-3.5 w-3.5" />
        {Number(blog.views || 0).toLocaleString('en-IN')} views
      </span>
    </p>
  );

  return (
    <div className="min-h-screen bg-[#f6f7fb]">
      <Navbar />

      <section className="pt-32 pb-14 sm:pt-36 md:pt-40">
        <div className="container mx-auto px-3 sm:px-4">
          <div className="mx-auto max-w-6xl">
            {loading ? (
              <div className="py-20 text-center">
                <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-brand-primary"></div>
                <p className="text-gray-500">Loading blogs...</p>
              </div>
            ) : (
              <>
                <nav className="mb-3 flex flex-wrap items-center gap-2 text-sm text-gray-500" aria-label="Breadcrumb">
                  <Link href="/" className="font-semibold text-[#0a4ea3] hover:underline">
                    Home
                  </Link>
                  <span className="text-gray-400">›</span>
                  <span className="font-semibold text-gray-700">Blogs</span>
                </nav>
                <h1 className="text-3xl font-extrabold text-[#163A78] sm:text-4xl">Our Blog</h1>
                <p className="mt-2 text-sm text-gray-500">Car care tips, service guides, and updates from MyFNG.</p>

                <div className="mt-8 flex flex-col gap-4 sm:mt-10 sm:flex-row sm:items-center sm:justify-end">
                  <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                    <div className="relative w-full sm:w-72" ref={datePickerRef}>
                      <button
                        type="button"
                        aria-label="Filter posts by date"
                        aria-expanded={dateOpen}
                        onClick={() => {
                          const base = selectedDate || Object.keys(calendarCounts).sort().reverse()[0] || '';
                          if (base) setVisibleMonth(base.slice(0, 7));
                          else setVisibleMonth(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit' }).format(new Date()));
                          setDateOpen((open) => !open);
                        }}
                        className="flex w-full items-center gap-2 rounded-full border border-gray-200 bg-white py-2.5 pl-4 pr-10 text-left text-sm text-gray-700 outline-none focus:border-[#023D95]"
                      >
                        <Calendar className="h-4 w-4 shrink-0 text-gray-400" />
                        <span className="truncate">
                          {selectedDate
                            ? `${formatBlogDate(`${selectedDate}T12:00:00+05:30`)} (${postCountByDate.get(selectedDate) || 0})`
                            : 'All dates'}
                        </span>
                      </button>
                      {selectedDate ? (
                        <button
                          type="button"
                          aria-label="Clear date"
                          onClick={() => applyDate('')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      ) : null}
                      {dateOpen && visibleMonth ? (
                        <div className="absolute right-0 top-full z-30 mt-2 w-[320px] rounded-2xl border border-gray-200 bg-white p-4 shadow-xl">
                          <div className="mb-3 flex items-center justify-between">
                            <button
                              type="button"
                              aria-label="Previous month"
                              onClick={() => setVisibleMonth((month) => shiftMonth(month, -1))}
                              className="rounded-full p-1 text-gray-500 hover:bg-gray-100"
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </button>
                            <p className="text-sm font-semibold text-[#163A78]">{monthLabel(visibleMonth)}</p>
                            <button
                              type="button"
                              aria-label="Next month"
                              onClick={() => setVisibleMonth((month) => shiftMonth(month, 1))}
                              className="rounded-full p-1 text-gray-500 hover:bg-gray-100"
                            >
                              <ChevronRight className="h-4 w-4" />
                            </button>
                          </div>
                          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-gray-400">
                            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
                              <span key={day} className="py-1">{day}</span>
                            ))}
                          </div>
                          <div className="mt-1 grid grid-cols-7 gap-1">
                            {monthCells(visibleMonth).map((key, index) => {
                              if (!key) return <span key={`empty-${index}`} />;
                              const count = postCountByDate.get(key) || 0;
                              const selected = key === selectedDate;
                              return (
                                <button
                                  key={key}
                                  type="button"
                                  disabled={!count}
                                  onClick={() => applyDate(key)}
                                  className={`flex h-10 flex-col items-center justify-center rounded-lg text-sm ${
                                    selected
                                      ? 'bg-[#023D95] text-white'
                                      : count
                                        ? 'text-gray-800 hover:bg-blue-50'
                                        : 'cursor-default text-gray-300'
                                  }`}
                                >
                                  <span className="leading-none">{Number(key.slice(-2))}</span>
                                  <span className={`mt-0.5 text-[9px] leading-none ${selected ? 'text-white/80' : 'text-[#023D95]'}`}>
                                    {count || ''}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                          <button
                            type="button"
                            onClick={() => applyDate('')}
                            className="mt-3 w-full rounded-full py-2 text-sm font-semibold text-[#023D95] hover:bg-blue-50"
                          >
                            All dates
                          </button>
                        </div>
                      ) : null}
                    </div>
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search posts"
                      value={searchQuery}
                      onChange={(e) => {
                        const v = e.target.value;
                        setSearchQuery(v);
                        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
                        searchDebounceRef.current = setTimeout(() => {
                          setCurrentPage(1);
                          updateUrl({ q: v, category: selectedCategory, date: selectedDate, page: 1 });
                        }, 400);
                      }}
                      className="w-full rounded-full border border-gray-200 bg-white py-2.5 pl-11 pr-4 text-sm outline-none focus:border-[#023D95]"
                    />
                  </div>
                  </div>
                </div>

                {hasActiveFilters ? (
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <p className="text-sm text-gray-600">
                      {totalCount === 0
                        ? 'No posts match your filters.'
                        : `${totalCount.toLocaleString('en-IN')} post${totalCount === 1 ? '' : 's'} found`}
                    </p>
                    <button
                      type="button"
                      onClick={clearAllFilters}
                      className="rounded-full bg-[#023D95] px-4 py-1.5 text-sm font-semibold text-white hover:brightness-110"
                    >
                      View all blogs
                    </button>
                  </div>
                ) : null}

                {totalCount === 0 && !loading ? (
                  <div className="mt-10 rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-16 text-center">
                    <p className="text-base font-semibold text-gray-700">No blog posts found matching your criteria.</p>
                    <p className="mt-2 text-sm text-gray-500">Try a different keyword or clear filters to see all posts.</p>
                    <button
                      type="button"
                      onClick={clearAllFilters}
                      className="mt-6 rounded-full bg-[#023D95] px-5 py-2 text-sm font-semibold text-white hover:brightness-110"
                    >
                      View all blogs
                    </button>
                  </div>
                ) : (
                  <>
                {featured ? (
                <Link
                  href={`/blogs/${featured.slug}`}
                  className="mt-10 grid items-center overflow-hidden rounded-3xl bg-white shadow-sm lg:grid-cols-[3fr_2fr]"
                >
                  {cover(featured, 'aspect-video w-full !bg-white', true)}
                  <div className="flex flex-col justify-center px-6 py-8 sm:px-10 sm:py-12">
                    <span className="mb-4 inline-flex w-fit rounded-full bg-[#FFF1E4] px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-[#E07A2F]">
                      Featured{featured.category?.name ? ` · ${featured.category.name}` : ''}
                    </span>
                    <h2 className="text-2xl font-extrabold leading-tight text-[#163A78] sm:text-4xl">
                      {featured.title}
                    </h2>
                    {featured.excerpt ? (
                      <p className="mt-4 line-clamp-3 text-sm leading-6 text-gray-500 sm:text-base">{featured.excerpt}</p>
                    ) : null}
                    <div className="mt-6">{meta(featured)}</div>
                  </div>
                </Link>
                ) : null}

                <h2 className="mt-12 text-3xl font-extrabold text-[#163A78]">Latest Posts</h2>

                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategory('all');
                      setCurrentPage(1);
                      updateUrl({ q: searchQuery, category: 'all', date: selectedDate, page: 1 });
                    }}
                    className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
                      selectedCategory === 'all' ? 'text-white' : 'bg-white text-gray-700'
                    }`}
                    style={selectedCategory === 'all' ? { backgroundColor: NAVY } : undefined}
                  >
                    All
                  </button>
                  {categories.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => {
                        setSelectedCategory(category.id);
                        setCurrentPage(1);
                        updateUrl({ q: searchQuery, category: category.id, date: selectedDate, page: 1 });
                      }}
                      className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
                        selectedCategory === category.id ? 'text-white' : 'bg-white text-gray-700'
                      }`}
                      style={selectedCategory === category.id ? { backgroundColor: NAVY } : undefined}
                    >
                      {category.name}
                    </button>
                  ))}
                  <Link href="/automobile-news" className="rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-[#023D95]">
                    Automobile News
                  </Link>
                </div>

                <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {gridPosts.map((blog) => {
                    return (
                      <Link
                        key={blog.id}
                        href={`/blogs/${blog.slug}`}
                        className="flex flex-col overflow-hidden rounded-3xl bg-white shadow-sm"
                      >
                        {cover(blog, 'aspect-video')}
                        <div className="flex flex-1 flex-col px-6 py-6">
                          <h3 className="text-xl font-extrabold leading-snug text-[#163A78] line-clamp-3">{blog.title}</h3>
                          {blog.excerpt ? (
                            <p className="mt-3 line-clamp-3 text-sm leading-6 text-gray-500">{blog.excerpt}</p>
                          ) : null}
                          <div className="mt-auto pt-5">{meta(blog)}</div>
                        </div>
                      </Link>
                    );
                  })}
                </div>

                {gridPosts.length === 0 && featured ? (
                  <p className="mt-8 text-center text-sm text-gray-500">No more posts on this page.</p>
                ) : null}

                {totalPages > 1 ? (
                  <div className="flex items-center justify-center gap-2 mt-8 px-2">
                    <button
                      type="button"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="px-3 py-2 rounded-md border border-gray-300 text-sm disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                      Prev
                    </button>
                    <span className="text-sm text-gray-600 whitespace-nowrap sm:hidden">
                      Page {currentPage} of {totalPages}
                    </span>
                    <div className="hidden sm:flex items-center gap-2">
                      {getVisiblePageNumbers(currentPage, totalPages).map((page) => (
                        <button
                          key={page}
                          type="button"
                          onClick={() => handlePageChange(page)}
                          className={`min-w-[2.25rem] px-3 py-2 rounded-md border text-sm ${
                            currentPage === page
                              ? 'bg-brand-primary text-white border-brand-primary'
                              : 'border-gray-300 text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          {page}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="px-3 py-2 rounded-md border border-gray-300 text-sm disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                      Next
                    </button>
                  </div>
                ) : null}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}

