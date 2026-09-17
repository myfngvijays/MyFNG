import { CITY_PAGES, type CityPageConfig } from '@/lib/city-pages';
import { ensureAiOverviewHtml } from '@/lib/blog/dailyAiOverview';
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
  { re: /pickup|drop[\s-]?off|collect(?:ion)?/i, slug: 'periodic-service' },
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
      url: '/go/myfngapp',
      anchor: 'Download the MyFNG app',
      when: 'Primary conversion. Use whenever asking the reader to book, track, or manage service on the phone.',
    },
    {
      url: '/book-service',
      anchor: `Book car service in ${cityLabel}`,
      when: 'Use as a secondary CTA if the reader prefers the website booking form.',
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
  appDownloadUrl?: string;
}) {
  const cityPage = matchCityPage(opts.city);
  const cityLabel = cityPage?.name || String(opts.city || '').trim() || 'your city';
  const bookUrl = buildBlogTrackedPath('/book-service', opts.campaign, 'inline-cta', opts.focusKeyword);
  const appUrl =
    opts.appDownloadUrl ||
    buildBlogTrackedPath('/go/myfngapp', opts.campaign, 'app-download', opts.focusKeyword);
  return [
    '<div class="blog-post-cta" data-myfng-cta="1">',
    `<h3>Need trusted car service in ${escapeHtml(cityLabel)}?</h3>`,
    '<p>Download the MyFNG app to book workshop service with pickup &amp; drop — we collect your car, service it at the workshop, and return it.</p>',
    '<div class="blog-post-cta-actions">',
    `<a href="${encodeHref(appUrl)}" class="app-btn">Download MyFNG App</a>`,
    `<a href="${bookUrl}" class="book-btn">Book Service Now</a>`,
    '<a href="tel:+919152307030" class="blog-post-cta-phone">Call +91-9152307030</a>',
    '</div>',
    '</div>',
  ].join('');
}

export function buildAboutMyFngHtml(appDownloadUrl: string) {
  const appUrl = encodeHref(appDownloadUrl || '/go/myfngapp');
  return [
    '<div class="blog-about-myfng" data-myfng-about="1">',
    '<h2>About MyFNG</h2>',
    '<p>MyFNG is your friendly neighbourhood garage network for multi-brand car service across Pune, Mumbai and nearby cities. We collect your car, service it at a trusted workshop, and drop it back. We do not send a mechanic to service the car at your house.</p>',
    '<h2>Book on the MyFNG app</h2>',
    `<p>Download the MyFNG app to book pickup &amp; drop, track your car, and get live workshop updates. <a href="${appUrl}">Download the MyFNG app</a> and finish booking in a few taps.</p>`,
    '</div>',
  ].join('');
}

function headingText(html: string) {
  return stripTags(html).replace(/\s+/g, ' ').trim();
}

function headingId(text: string) {
  return `sec-${toCampaignSlug(text)}`.slice(0, 70);
}

function skipTocHeading(text: string) {
  return /table of contents|about myfng|book on the myfng|related reading|related resources|pricing disclaimer/i.test(text);
}

function stripExistingToc(html: string) {
  const source = String(html || '');
  const start = source.search(/<div\b[^>]*(?:blog-toc|data-blog-toc)/i);
  if (start < 0) return source;
  let depth = 0;
  const openRe = /<\/?div\b/gi;
  openRe.lastIndex = start;
  let match: RegExpExecArray | null;
  while ((match = openRe.exec(source))) {
    if (match[0].toLowerCase() === '<div') depth += 1;
    else depth -= 1;
    if (depth === 0) {
      return `${source.slice(0, start)}${source.slice(match.index + match[0].length + 1)}`.replace(/>\s*>/, '>');
    }
  }
  return source;
}

export function ensureIntroAndToc(html: string, excerpt?: string) {
  let source = stripExistingToc(String(html || '')).trim();
  if (!source) return source;

  const headings: Array<{ id: string; text: string }> = [];
  source = source.replace(/<h2\b([^>]*)>([\s\S]*?)<\/h2>/gi, (full, attrs: string, inner: string) => {
    const text = headingText(inner);
    if (!text || skipTocHeading(text)) return full;
    const existing = String(attrs).match(/\bid=["']([^"']+)["']/i);
    const id = existing?.[1] || headingId(text);
    headings.push({ id, text });
    if (existing) return full;
    return `<h2${attrs} id="${id}">${inner}</h2>`;
  });

  const firstH2 = source.search(/<h2\b/i);
  let before = firstH2 >= 0 ? source.slice(0, firstH2) : source;
  const after = firstH2 >= 0 ? source.slice(firstH2) : '';
  let localBlocks = '';
  before = before.replace(/<p\b[^>]*data-local-seo[\s\S]*?<\/p>/gi, (block) => {
    localBlocks += `${block}\n`;
    return '';
  });
  const hasIntro = /<p\b/i.test(before);
  const intro =
    !hasIntro && excerpt
      ? `<p>${escapeHtml(String(excerpt).replace(/\s+/g, ' ').trim())}</p>\n`
      : '';

  const hasToc = /data-blog-toc|blog-toc/i.test(source);
  const toc =
    !hasToc && headings.length >= 2
      ? [
          '<div class="blog-toc" data-blog-toc="1">',
          '<h2>Table of Contents</h2>',
          '<ol>',
          ...headings.map((h) => `<li><a href="#${h.id}">${escapeHtml(h.text)}</a></li>`),
          '</ol>',
          '</div>\n',
        ].join('')
      : '';

  return `${intro}${before}${toc}${localBlocks}${after}`;
}

function stripDivByAttr(html: string, pattern: RegExp) {
  const source = String(html || '');
  const start = source.search(pattern);
  if (start < 0) return source;
  let depth = 0;
  const openRe = /<\/?div\b/gi;
  openRe.lastIndex = start;
  let match: RegExpExecArray | null;
  while ((match = openRe.exec(source))) {
    if (match[0].toLowerCase() === '<div') depth += 1;
    else depth -= 1;
    if (depth === 0) {
      return `${source.slice(0, start)}${source.slice(match.index + match[0].length + 1)}`.replace(/>\s*>/, '>');
    }
  }
  return source;
}

function stripHeadingSection(html: string, headingRe: RegExp) {
  return String(html || '').replace(
    new RegExp(`<h2\\b[^>]*>\\s*(?:${headingRe.source})[\\s\\S]*?(?=<h2\\b|$)`, 'gi'),
    '',
  );
}

export function ensureAboutMyFngHtml(html: string, appDownloadUrl: string) {
  let source = String(html || '').trim();
  for (let i = 0; i < 4; i += 1) {
    const next = stripDivByAttr(source, /<div\b[^>]*(?:data-myfng-about|blog-about-myfng)/i);
    if (next === source) break;
    source = next;
  }
  source = stripHeadingSection(source, /About MyFNG|Book on the MyFNG(?: app)?/);
  return `${source.replace(/\n{3,}/g, '\n\n').trim()}\n${buildAboutMyFngHtml(appDownloadUrl)}`;
}

export function stripExistingCta(html: string) {
  const source = String(html || '');
  const start = source.search(/<div\b[^>]*(?:blog-post-cta|data-myfng-cta)/i);
  if (start < 0) return source;
  let depth = 0;
  const openRe = /<\/?div\b/gi;
  openRe.lastIndex = start;
  let match: RegExpExecArray | null;
  while ((match = openRe.exec(source))) {
    if (match[0].toLowerCase() === '<div') depth += 1;
    else depth -= 1;
    if (depth === 0) {
      return `${source.slice(0, start)}${source.slice(match.index + match[0].length + 1)}`.replace(
        />\s*>/,
        '>',
      );
    }
  }
  return source;
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
  if (raw.includes('/go/myfngapp') || raw.includes('app-download')) return 'app-download';
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
    .slice(0, 3)
    .map((b) => {
      const url = buildBlogTrackedPath(`/blogs/${b.slug}`, campaign, 'related-reading', term);
      return `<li><a href="${encodeHref(url)}">${escapeHtml(b.title)}</a></li>`;
    })
    .join('');
  return `<h2>Related reading on MyFNG</h2><ul>${items}</ul>`;
}

export function ensureLocalSeoHtml(
  html: string,
  opts?: { city?: string; areas?: string[]; keywords?: string[] },
) {
  const source = String(html || '');
  const city = String(opts?.city || '').trim();
  const areas = (opts?.areas || []).map((a) => String(a || '').trim()).filter(Boolean);
  const keywords = (opts?.keywords || []).map((k) => String(k || '').trim()).filter(Boolean);
  if (!city && !areas.length && !keywords.length) return source;
  if (/data-local-seo/i.test(source)) return source;

  const usedAreas = areas.filter((a) => source.toLowerCase().includes(a.toLowerCase()));
  const usedKeywords = keywords.filter((k) => source.toLowerCase().includes(k.toLowerCase()));
  if (usedAreas.length >= 4 && keywords.length > 0 && usedKeywords.length >= keywords.length) return source;

  const missingAreas = areas.filter((a) => !usedAreas.some((u) => u.toLowerCase() === a.toLowerCase())).slice(0, 6);
  const missingKeywords = keywords.filter((k) => !usedKeywords.some((u) => u.toLowerCase() === k.toLowerCase()));
  const areaText = (missingAreas.length ? missingAreas : areas).slice(0, 6).join(', ');
  const allKeywords = (missingKeywords.length ? missingKeywords : keywords).join(', ');
  const kwLead = missingKeywords[0] || keywords[0] || (city ? `car service in ${city}` : 'car service');
  const kwPickup = missingKeywords.find((k) => /pickup/i.test(k)) || keywords.find((k) => /pickup/i.test(k));
  const extraKeywords = (missingKeywords.length ? missingKeywords : keywords).filter(
    (k) => k !== kwLead && k !== kwPickup,
  );
  const para = [
    `<p data-local-seo="1">`,
    city ? `${escapeHtml(city)} drivers` : 'Local drivers',
    areaText ? ` in ${escapeHtml(areaText)}` : '',
    ` often search for ${escapeHtml(kwLead)}`,
    kwPickup ? ` and ${escapeHtml(kwPickup)}` : '',
    extraKeywords.length ? `, plus ${escapeHtml(extraKeywords.join(', '))}` : '',
    `. Book on the MyFNG app — we collect the car, service it at a nearby workshop, and drop it back. We do not send a mechanic to your house.`,
    allKeywords && extraKeywords.length < 2 ? ` People also look for ${escapeHtml(allKeywords)}.` : '',
    `</p>`,
  ].join('');

  const afterToc = source.match(/<div\b[^>]*(?:blog-toc|data-blog-toc)[\s\S]*?<\/div>/i);
  if (afterToc && afterToc.index != null) {
    const end = afterToc.index + afterToc[0].length;
    return `${source.slice(0, end)}\n${para}\n${source.slice(end)}`;
  }
  const firstH2 = source.search(/<h2\b(?![^>]*Table of Contents)/i);
  if (firstH2 >= 0) return `${source.slice(0, firstH2)}${para}\n${source.slice(firstH2)}`;
  return `${source}\n${para}`;
}

export function enrichAiGeneratedHtml(opts: {
  html: string;
  slug: string;
  city?: string;
  focusKeyword?: string;
  excerpt?: string;
  localAreas?: string[];
  localKeywords?: string[];
  relatedBlogs?: RelatedBlogLink[];
  appDownloadUrl?: string;
  informativeOnly?: boolean;
}): { html: string; links: EnrichedBlogLinks } {
  let html = String(opts.html || '').trim();
  const campaign = toCampaignSlug(opts.slug);
  const term = String(opts.focusKeyword || '').trim() || undefined;
  const related = opts.relatedBlogs || [];
  const informativeOnly = Boolean(opts.informativeOnly);

  html = rewriteAnchors(html, campaign, term);
  html = stripExistingCta(html).trim();
  html = ensureIntroAndToc(html, opts.excerpt);
  if (!informativeOnly) {
    html = ensureLocalSeoHtml(html, {
      city: opts.city,
      areas: opts.localAreas,
      keywords: opts.localKeywords,
    });
    html = ensureAiOverviewHtml(html);
    html = ensureAboutMyFngHtml(
      html,
      opts.appDownloadUrl || buildBlogTrackedPath('/go/myfngapp', campaign, 'app-download', term),
    );
    html = `${html}\n${buildCtaHtml({
      city: opts.city,
      campaign,
      focusKeyword: term,
      appDownloadUrl: opts.appDownloadUrl,
    })}`;
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
  appDownloadUrl?: string;
}) {
  return {
    utm_required_on_every_http_link: {
      utm_source: BLOG_UTM_SOURCE,
      utm_medium: BLOG_UTM_MEDIUM,
      utm_campaign: toCampaignSlug(opts.campaignHint),
      utm_term: String(opts.focusKeyword || opts.topic || '').trim() || undefined,
      utm_content: 'Use app-download | inline-cta | mid-cta | related-blog | service-page | external-ref',
    },
    myfng_facts: {
      no_doorstep_service: true,
      pickup_and_drop_only: true,
    },
    myfng_cta: {
      required: true,
      app_download_url: opts.appDownloadUrl || '/go/myfngapp',
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
