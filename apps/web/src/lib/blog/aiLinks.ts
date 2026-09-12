import { CITY_PAGES, type CityPageConfig } from '@/lib/city-pages';
import { DEFAULT_SERVICES, INTERNAL_SLUG_TO_MARKETING } from '@/lib/services/catalog';
import { SITE_URL } from '@/lib/seo/metadata';

export const BLOG_UTM_SOURCE = 'blog';
export const BLOG_UTM_MEDIUM = 'organic';

export type RelatedBlogLink = {
  title: string;
  slug: string;
  excerpt?: string | null;
};

export type BlogLinkItem = {
  kind: 'cta' | 'internal' | 'external';
  anchor: string;
  url: string;
};

export type BlogLinkCatalogItem = {
  url: string;
  anchor: string;
  when: string;
};

export type EnrichedBlogLinks = {
  has_cta: boolean;
  cta_url: string;
  internal: BlogLinkItem[];
  external: BlogLinkItem[];
  related_articles: Array<{ title: string; url: string }>;
};

const SERVICE_TOPIC_HINTS: Array<{ re: RegExp; slug: string }> = [
  { re: /\bac\b|air[\s-]?cond/i, slug: 'ac-service' },
  { re: /brake/i, slug: 'brake-service' },
  { re: /clutch/i, slug: 'clutch-service' },
  { re: /battery|electrical/i, slug: 'battery-service' },
  { re: /tyre|tire|wheel|alignment/i, slug: 'tyre-wheel-care' },
  { re: /dent|paint|scratch/i, slug: 'denting-painting' },
  { re: /detail|ceramic|polish/i, slug: 'detailing-service' },
  { re: /suspension|steering/i, slug: 'suspension-steering-service' },
  { re: /engine|oil|overheat/i, slug: 'engine-service' },
  { re: /periodic|skip(?:ped)?|missed|regular[\s-]?service|maintenance/i, slug: 'periodic-service' },
];

const TRUSTED_EXTERNAL_HOSTS = [
  'wikipedia.org',
  'gov.in',
  'nic.in',
  'araiindia.com',
  'siam.in',
  'bis.gov.in',
  'morth.nic.in',
  'honda.com',
  'marutisuzuki.com',
  'hyundai.com',
  'tatamotors.com',
  'toyota.com',
  'mahindra.com',
  'kia.com',
  'volkswagen.co.in',
  'skoda-auto.co.in',
];

export function toCampaignSlug(text: string) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80) || 'blog';
}

export function matchCityPage(city?: string | null): CityPageConfig | null {
  const raw = String(city || '').trim().toLowerCase();
  if (!raw) return null;
  const compact = raw.replace(/[^a-z]/g, '');
  if (!compact) return null;
  return (
    CITY_PAGES.find((c) => {
      const name = c.name.toLowerCase().replace(/[^a-z]/g, '');
      const slug = c.slug.replace(/-/g, '');
      return compact === name || compact === slug || compact.includes(name) || name.includes(compact) || compact.includes(slug) || slug.includes(compact);
    }) || null
  );
}

function servicePublicPath(internalSlug: string) {
  const marketing = INTERNAL_SLUG_TO_MARKETING[internalSlug] || `car-${internalSlug}`;
  return `/car-services/${marketing}`;
}

export function matchServiceFromTopic(topic: string, focusKeyword?: string) {
  const hay = `${topic} ${focusKeyword || ''}`;
  const hit = SERVICE_TOPIC_HINTS.find((h) => h.re.test(hay));
  if (!hit) return DEFAULT_SERVICES[0];
  return DEFAULT_SERVICES.find((s) => s.slug === hit.slug) || DEFAULT_SERVICES[0];
}

export function buildBlogTrackedPath(
  pathOrUrl: string,
  campaign: string,
  content: string,
  term?: string,
) {
  const raw = String(pathOrUrl || '').trim();
  if (!raw || raw.startsWith('#') || raw.startsWith('mailto:') || raw.startsWith('tel:')) return raw;

  try {
    const abs = /^https?:\/\//i.test(raw);
    const url = abs ? new URL(raw) : new URL(raw, SITE_URL);

    if (!url.searchParams.get('utm_source')) url.searchParams.set('utm_source', BLOG_UTM_SOURCE);
    if (!url.searchParams.get('utm_medium')) url.searchParams.set('utm_medium', BLOG_UTM_MEDIUM);
    if (!url.searchParams.get('utm_campaign')) url.searchParams.set('utm_campaign', toCampaignSlug(campaign));
    if (term && !url.searchParams.get('utm_term')) {
      url.searchParams.set('utm_term', String(term).trim().slice(0, 80));
    }
    if (content && !url.searchParams.get('utm_content')) {
      url.searchParams.set('utm_content', toCampaignSlug(content));
    }

    const host = url.hostname.replace(/^www\./i, '').toLowerCase();
    const isMyFng = !abs || host === 'myfng.in' || host.endsWith('.myfng.in');
    if (isMyFng) return `${url.pathname}${url.search}${url.hash}`;
    return url.toString();
  } catch {
    return raw;
  }
}

export function listInternalLinkCatalog(opts: {
  city?: string;
  topic?: string;
  focusKeyword?: string;
}): BlogLinkCatalogItem[] {
  const cityPage = matchCityPage(opts.city);
  const cityLabel = cityPage?.name || String(opts.city || '').trim() || 'your city';
  const service = matchServiceFromTopic(opts.topic || '', opts.focusKeyword);

  const items: BlogLinkCatalogItem[] = [
    {
      url: '/book-service',
      anchor: `Book car service in ${cityLabel}`,
      when: 'Use for the primary MyFNG CTA and whenever the reader should take action.',
    },
    {
      url: servicePublicPath(service.slug),
      anchor: service.title,
      when: `Use when discussing ${service.title.toLowerCase()} or related symptoms.`,
    },
    {
      url: '/workshop-locator',
      anchor: `Find a MyFNG workshop in ${cityLabel}`,
      when: 'Use when mentioning nearby garage, pickup, or workshop visit.',
    },
    {
      url: '/car-roadside-assistance',
      anchor: 'MyFNG roadside assistance',
      when: 'Use only if the article mentions breakdown, towing, jump-start, or emergency help.',
    },
    {
      url: '/blogs',
      anchor: 'More MyFNG car care guides',
      when: 'Use once if pointing readers to more articles.',
    },
    {
      url: '/faqs',
      anchor: 'MyFNG service FAQs',
      when: 'Use if mentioning common booking or warranty questions.',
    },
  ];

  if (cityPage) {
    items.splice(2, 0, {
      url: cityPage.pagePath,
      anchor: `Car service in ${cityPage.name}`,
      when: `Use when talking about local service options in ${cityPage.name}.`,
    });
  }

  return items;
}

export function buildCtaHtml(opts: {
  city?: string;
  campaign: string;
  focusKeyword?: string;
}) {
  const cityPage = matchCityPage(opts.city);
  const cityLabel = cityPage?.name || String(opts.city || '').trim() || 'your city';
  const bookUrl = buildBlogTrackedPath('/book-service', opts.campaign, 'inline-cta', opts.focusKeyword);
  return [
    '<div class="blog-post-cta" data-myfng-cta="1">',
    `<h3>Need trusted car service in ${escapeHtml(cityLabel)}?</h3>`,
    '<p>Book multi-brand car servicing with MyFNG — expert technicians, genuine parts, and convenient pickup &amp; drop.</p>',
    '<div class="blog-post-cta-actions">',
    `<a href="${bookUrl}" class="book-btn">Book Service Now</a>`,
    '<a href="tel:+919152307030" class="blog-post-cta-phone">Call +91-9152307030</a>',
    '</div>',
    '</div>',
  ].join('');
}

function escapeHtml(s: string) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function safeIlikeTerm(s: string) {
  return String(s || '')
    .replace(/[%_,.()"'\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40);
}

export async function fetchRelatedPublishedBlogs(
  supabase: { from: (table: string) => any },
  opts: { topic?: string; city?: string; focusKeyword?: string; limit?: number },
): Promise<RelatedBlogLink[]> {
  const limit = Math.max(2, Math.min(8, opts.limit || 6));
  const terms = [opts.focusKeyword, opts.topic, opts.city]
    .map((t) => safeIlikeTerm(String(t || '')))
    .filter((t) => t.length >= 3);

  const select = 'title, slug, excerpt';
  let rows: RelatedBlogLink[] = [];

  if (terms[0]) {
    const orParts = terms
      .slice(0, 2)
      .flatMap((t) => [`title.ilike.%${t}%`, `excerpt.ilike.%${t}%`])
      .join(',');
    const { data } = await supabase
      .from('blogs')
      .select(select)
      .ilike('status', 'published')
      .or(orParts)
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(limit);
    rows = (data || []) as RelatedBlogLink[];
  }

  if (rows.length < 2) {
    const { data } = await supabase
      .from('blogs')
      .select(select)
      .ilike('status', 'published')
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(limit);
    const extras = (data || []) as RelatedBlogLink[];
    const seen = new Set(rows.map((r) => r.slug));
    for (const row of extras) {
      if (!seen.has(row.slug)) {
        rows.push(row);
        seen.add(row.slug);
      }
    }
  }

  return rows.filter((r) => r.slug && r.title).slice(0, limit);
}

function decodeHref(raw: string) {
  return String(raw || '').trim().replace(/&amp;/g, '&');
}

function encodeHref(raw: string) {
  return String(raw || '').replace(/&/g, '&amp;');
}

function hostOf(href: string) {
  try {
    const abs = /^https?:\/\//i.test(href);
    const url = abs ? new URL(href) : new URL(href, SITE_URL);
    return url.hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return '';
  }
}

function isInternalHref(href: string) {
  const raw = decodeHref(href);
  if (!raw || raw.startsWith('#') || raw.startsWith('mailto:') || raw.startsWith('tel:')) return false;
  if (raw.startsWith('/')) return true;
  const host = hostOf(raw);
  return host === 'myfng.in' || host.endsWith('.myfng.in');
}

function isExternalHref(href: string) {
  const raw = decodeHref(href);
  if (!raw || raw.startsWith('#') || raw.startsWith('mailto:') || raw.startsWith('tel:')) return false;
  if (raw.startsWith('/')) return false;
  return /^https?:\/\//i.test(raw) && !isInternalHref(raw);
}

function inferPlacement(href: string, inCta: boolean) {
  const raw = decodeHref(href).toLowerCase();
  if (inCta || raw.includes('book-service')) return 'inline-cta';
  if (raw.includes('/blogs/')) return 'related-blog';
  if (raw.includes('/car-service')) return 'service-page';
  if (raw.includes('workshop-locator')) return 'workshop-locator';
  if (isExternalHref(raw)) return 'external-ref';
  return 'internal-link';
}

function isTrustedExternal(href: string) {
  const host = hostOf(href);
  return TRUSTED_EXTERNAL_HOSTS.some((d) => host === d || host.endsWith(`.${d}`));
}

function stripTags(html: string) {
  return String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function collectLinks(html: string): BlogLinkItem[] {
  const items: BlogLinkItem[] = [];
  const re = /<a\b([^>]*?)href=["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const href = decodeHref(m[2]);
    const anchor = stripTags(m[4]).slice(0, 120);
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) continue;
    const kind: BlogLinkItem['kind'] = href.includes('book-service')
      ? 'cta'
      : isExternalHref(href)
        ? 'external'
        : 'internal';
    items.push({ kind, anchor: anchor || href, url: href });
  }
  return items;
}

function rewriteAnchors(html: string, campaign: string, term?: string) {
  return html.replace(/<a\b([^>]*?)>/gi, (full, attrs: string) => {
    const hrefMatch = String(attrs).match(/href=["']([^"']+)["']/i);
    if (!hrefMatch) return full;
    const href = decodeHref(hrefMatch[1]);
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return full;

    const nextHref = buildBlogTrackedPath(href, campaign, inferPlacement(href, false), term);
    let nextAttrs = String(attrs).replace(/href=["'][^"']+["']/i, `href="${encodeHref(nextHref)}"`);

    if (isExternalHref(nextHref)) {
      if (!/\btarget=/i.test(nextAttrs)) nextAttrs += ' target="_blank"';
      const rel = isTrustedExternal(nextHref) ? 'noopener noreferrer' : 'noopener noreferrer nofollow';
      if (/\brel=/i.test(nextAttrs)) {
        nextAttrs = nextAttrs.replace(/\brel=["'][^"']*["']/i, `rel="${rel}"`);
      } else {
        nextAttrs += ` rel="${rel}"`;
      }
    }

    return `<a${nextAttrs}>`;
  });
}

function hasCta(html: string) {
  return /data-myfng-cta|blog-post-cta|book-service/i.test(html);
}

function blogLinkCount(html: string) {
  return (html.match(/href=["'][^"']*\/blogs\/[^"']+["']/gi) || []).length;
}

function relatedReadingHtml(blogs: RelatedBlogLink[], campaign: string, term?: string) {
  if (!blogs.length) return '';
  const items = blogs
    .slice(0, 4)
    .map((b) => {
      const url = buildBlogTrackedPath(`/blogs/${b.slug}`, campaign, 'related-reading', term);
      return `<li><a href="${encodeHref(url)}">${escapeHtml(b.title)}</a></li>`;
    })
    .join('');
  return `<h2>Related reading on MyFNG</h2><ul>${items}</ul>`;
}

export function enrichAiGeneratedHtml(opts: {
  html: string;
  slug: string;
  city?: string;
  focusKeyword?: string;
  relatedBlogs?: RelatedBlogLink[];
}): { html: string; links: EnrichedBlogLinks } {
  let html = String(opts.html || '').trim();
  const campaign = toCampaignSlug(opts.slug);
  const term = String(opts.focusKeyword || '').trim() || undefined;
  const related = opts.relatedBlogs || [];

  html = rewriteAnchors(html, campaign, term);

  if (!hasCta(html)) {
    html = `${html}\n${buildCtaHtml({ city: opts.city, campaign, focusKeyword: term })}`;
  }

  if (related.length && blogLinkCount(html) < 2) {
    html = `${html}\n${relatedReadingHtml(related, campaign, term)}`;
  }

  const collected = collectLinks(html);
  const cta = collected.find((l) => l.kind === 'cta') || collected.find((l) => /book-service/i.test(l.url));
  const relatedArticles = related.slice(0, 4).map((b) => ({
    title: b.title,
    url: buildBlogTrackedPath(`/blogs/${b.slug}`, campaign, 'related-article', term),
  }));

  return {
    html,
    links: {
      has_cta: hasCta(html),
      cta_url: cta?.url || buildBlogTrackedPath('/book-service', campaign, 'inline-cta', term),
      internal: collected.filter((l) => l.kind !== 'external'),
      external: collected.filter((l) => l.kind === 'external'),
      related_articles: relatedArticles,
    },
  };
}

export function buildAiLinkPromptPayload(opts: {
  city?: string;
  topic?: string;
  focusKeyword?: string;
  relatedBlogs?: RelatedBlogLink[];
  campaignHint: string;
}) {
  return {
    utm_required_on_every_http_link: {
      utm_source: BLOG_UTM_SOURCE,
      utm_medium: BLOG_UTM_MEDIUM,
      utm_campaign: toCampaignSlug(opts.campaignHint),
      utm_term: String(opts.focusKeyword || opts.topic || '').trim() || undefined,
      utm_content: 'Use inline-cta | mid-cta | related-blog | service-page | external-ref',
    },
    myfng_cta: {
      required: true,
      book_path: '/book-service',
      phone: '+91-9152307030',
      wrap_in: '<div class="blog-post-cta">...</div>',
    },
    internal_pages: listInternalLinkCatalog(opts),
    related_blogs: (opts.relatedBlogs || []).map((b) => ({
      title: b.title,
      url: `/blogs/${b.slug}`,
      excerpt: b.excerpt || undefined,
    })),
    external_references: {
      optional: true,
      only_when_citing_a_standard_manual_or_official_guideline: true,
      do_not_invent_urls: true,
      allowed_examples: [
        'https://en.wikipedia.org/wiki/Vehicle_maintenance',
        'https://www.araiindia.com/',
        'Official OEM owner-manual / service pages only if you are sure of the URL',
      ],
      add_same_utm_params: true,
    },
  };
}
