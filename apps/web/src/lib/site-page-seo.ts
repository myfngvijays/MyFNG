import { buildCityPageSeoDefaults, isCityPagePath } from '@/lib/city-pages';
import { buildPopularBrandSeoDefaults, POPULAR_BRAND_PAGES } from '@/lib/popular-brands';
import { isServicePagePath } from '@/lib/service-page-seo';
import { unstable_cache } from 'next/cache';
import type { Metadata } from 'next';
import { buildPageMetadata, type PageSeoConfig } from '@/lib/seo/metadata';
import { toSiteMediaUrl } from '@/lib/media/public-url';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export const SITE_PAGE_SEO_TABLE = 'site_page_seo';

export const MIGRATION_269_HINT =
  'Run `database/269_site_page_seo.sql` for admin-managed website page SEO.';

export type SitePageSeoRow = {
  id: string;
  page_path: string;
  page_label: string;
  title: string;
  description: string;
  keywords: string;
  keyphrase: string;
  og_image: string;
  canonical_path: string;
  og_type: 'website' | 'article';
  city: string;
  noindex: boolean;
  active: boolean;
  display_order: number;
  notes: string;
  created_at?: string;
  updated_at?: string;
};

export type SitePageSeoSeed = {
  page_path: string;
  page_label: string;
  display_order: number;
} & PageSeoConfig;

export const SITE_PAGE_SEO_DEFAULTS: SitePageSeoSeed[] = [
  {
    page_path: '/',
    page_label: 'Home',
    display_order: 1,
    title: 'Best Mechanic Near Me Mumbai | Best Car Repair Near Me | MyFNG',
    description:
      'Best car repair & mechanic near me in Mumbai, Pune & Thane. Book periodic service, AC repair, engine service, brake service & more at verified MYFNG workshops.',
    keywords: [
      'best mechanic near me',
      'best car repair near me',
      'car service near me Mumbai',
      'car service near me Pune',
      'car servicing Mumbai',
      'car repair Mumbai',
      'periodic car service',
      'MYFNG',
    ],
    keyphrase: 'best car repair near me',
    canonicalPath: '/',
    city: 'Mumbai',
  },
  {
    page_path: '/about-us',
    page_label: 'About Us',
    display_order: 2,
    title: "About Us - MYFNG | India's AI-Powered Car Service Platform",
    description:
      "Learn about MYFNG - India's first AI-powered car care platform. 100+ verified workshops across Mumbai, Pune, Thane & Navi Mumbai with transparent pricing.",
    keywords: ['about MYFNG', 'car service company India', 'verified car workshops', 'AI car service platform'],
    keyphrase: 'about MYFNG car service',
    canonicalPath: '/about-us',
    city: 'Mumbai',
  },
  {
    page_path: '/contact-us',
    page_label: 'Contact Us',
    display_order: 3,
    title: 'Contact Us - MYFNG | Car Service Support',
    description:
      'Contact MYFNG for car service bookings, roadside assistance & support. Call +91-8657575757 or visit our workshops in Mumbai, Pune & Thane.',
    keywords: ['contact MYFNG', 'car service contact', 'MYFNG customer support', 'car repair helpline'],
    keyphrase: 'contact MYFNG car service',
    canonicalPath: '/contact-us',
    city: 'Mumbai',
  },
  {
    page_path: '/faqs',
    page_label: 'FAQs',
    display_order: 4,
    title: 'FAQs - Car Service Questions Answered | MyFNG',
    description:
      'Find answers to common car service questions - periodic maintenance, AC repair, engine service, pricing, pickup & delivery, and MYFNG workshop policies.',
    keywords: ['car service FAQ', 'car repair questions', 'MYFNG FAQ', 'car maintenance FAQ'],
    keyphrase: 'car service FAQ',
    canonicalPath: '/faqs',
    city: 'Mumbai',
  },
  {
    page_path: '/car-services',
    page_label: 'Car Services',
    display_order: 5,
    title: 'Car Services - Periodic, AC, Engine & More | MyFNG',
    description:
      'Explore all car services at MYFNG - periodic service, AC service, engine repair, brake service, battery, clutch, denting & painting across Mumbai & Pune.',
    keywords: [
      'car services',
      'periodic car service',
      'car AC service',
      'car engine service',
      'car brake service',
      'car repair services Mumbai',
    ],
    keyphrase: 'car services near me',
    canonicalPath: '/car-services',
    city: 'Mumbai',
  },
  {
    page_path: '/book-service',
    page_label: 'Book Service',
    display_order: 6,
    title: 'Book Car Service Online | MyFNG',
    description:
      'Book car service online at MYFNG. Choose your city, car model, services & workshop. Free pickup & delivery available across Mumbai, Pune & Thane.',
    keywords: ['book car service online', 'car service booking', 'online car repair booking', 'MYFNG booking'],
    keyphrase: 'book car service online',
    canonicalPath: '/book-service',
    city: 'Mumbai',
  },
  {
    page_path: '/workshop-locator',
    page_label: 'Workshop Locator',
    display_order: 7,
    title: 'Find Car Workshops Near Me | MyFNG Verified Garages',
    description:
      'Find verified MYFNG car workshops near you in Mumbai, Pune, Thane & Navi Mumbai. Compare ratings, services & book online instantly.',
    keywords: ['car workshop near me', 'garage near me', 'MYFNG workshops', 'car service center near me'],
    keyphrase: 'car workshop near me',
    canonicalPath: '/workshop-locator',
    city: 'Mumbai',
  },
  {
    page_path: '/misa-ai',
    page_label: 'MISA AI Booking',
    display_order: 8,
    title: 'AI Car Service Booking | MyFNG',
    description:
      'Book car service instantly with MYFNG AI Booking Agent. Smart recommendations, transparent pricing & verified workshops in Mumbai, Pune & Thane.',
    keywords: ['AI car service booking', 'AI car repair', 'MYFNG AI booking'],
    keyphrase: 'AI car service booking',
    canonicalPath: '/misa-ai',
    city: 'Mumbai',
  },
  {
    page_path: '/car-roadside-assistance',
    page_label: 'Roadside Assistance',
    display_order: 9,
    title: 'Roadside Assistance (RSA) - 24x7 Emergency Help | MyFNG',
    description:
      'MYFNG Roadside Assistance - 24x7 emergency dispatch for towing, jumpstart, puncture repair, fuel delivery & on-road help across Mumbai & Pune.',
    keywords: ['roadside assistance', 'car breakdown help', 'emergency towing', 'RSA Mumbai', 'RSA Pune'],
    keyphrase: 'roadside assistance near me',
    canonicalPath: '/car-roadside-assistance',
    city: 'Mumbai',
  },
  {
    page_path: '/car-loan',
    page_label: 'Car Loan',
    display_order: 10,
    title: 'Car Loan - Easy Vehicle Finance | MyFNG',
    description:
      'Apply for car loan with MYFNG. Quick vehicle finance options with easy eligibility check for Mumbai, Pune & Thane customers.',
    keywords: ['car loan', 'vehicle finance', 'car loan Mumbai', 'car loan Pune'],
    keyphrase: 'car loan',
    canonicalPath: '/car-loan',
    city: 'Mumbai',
  },
  {
    page_path: '/blogs',
    page_label: 'Blogs',
    display_order: 11,
    title: 'Car Service Blogs - Tips, Guides & Maintenance | MyFNG',
    description:
      'Read expert car service blogs, maintenance tips, repair guides and local SEO articles from MYFNG workshops across Mumbai, Pune & Thane.',
    keywords: ['car service blog', 'car maintenance tips', 'car repair guide', 'MYFNG blog'],
    keyphrase: 'car service blog',
    canonicalPath: '/blogs',
    city: 'Mumbai',
  },
  {
    page_path: '/privacy-policy',
    page_label: 'Privacy Policy',
    display_order: 12,
    title: 'Privacy Policy | MyFNG',
    description:
      'Read MYFNG Privacy Policy. Learn how we collect, use and protect your personal data when you book car services on myfng.in.',
    keywords: ['MYFNG privacy policy', 'data protection', 'car service privacy'],
    canonicalPath: '/privacy-policy',
  },
  {
    page_path: '/terms-and-conditions',
    page_label: 'Terms & Conditions',
    display_order: 13,
    title: 'Terms and Conditions | MyFNG',
    description:
      'Read MYFNG Terms and Conditions for car service bookings, workshop policies, payments, cancellations and customer responsibilities.',
    keywords: ['MYFNG terms and conditions', 'car service terms', 'booking policy'],
    canonicalPath: '/terms-and-conditions',
  },
  ...buildCityPageSeoDefaults(),
  ...buildPopularBrandSeoDefaults(),
];

export function normalizePagePath(path: string): string {
  const trimmed = String(path || '').trim();
  if (!trimmed || trimmed === '/') return '/';
  const withSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  const withoutTrailing = withSlash.replace(/\/+$/, '');
  return withoutTrailing || '/';
}

export function keywordsToString(keywords: unknown): string {
  if (Array.isArray(keywords)) return keywords.map((k) => String(k).trim()).filter(Boolean).join(', ');
  return String(keywords || '').trim();
}

export function keywordsFromString(raw: unknown): string[] {
  return keywordsToString(raw)
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
}

export function getDefaultSeoForPath(path: string): SitePageSeoSeed | null {
  const normalized = normalizePagePath(path);
  return SITE_PAGE_SEO_DEFAULTS.find((row) => normalizePagePath(row.page_path) === normalized) || null;
}

export function mapSitePageSeoRow(row: any): SitePageSeoRow {
  const ogType = String(row.og_type || 'website').toLowerCase();
  return {
    id: String(row.id),
    page_path: normalizePagePath(row.page_path),
    page_label: String(row.page_label || '').trim(),
    title: String(row.title || '').trim(),
    description: String(row.description || '').trim(),
    keywords: keywordsToString(row.keywords),
    keyphrase: String(row.keyphrase || '').trim(),
    og_image: String(row.og_image || '').trim(),
    canonical_path: normalizePagePath(row.canonical_path || row.page_path || '/'),
    og_type: ogType === 'article' ? 'article' : 'website',
    city: String(row.city || 'Mumbai').trim() || 'Mumbai',
    noindex: row.noindex === true,
    active: row.active !== false,
    display_order: Number(row.display_order) || 0,
    notes: String(row.notes || '').trim(),
    created_at: row.created_at ? String(row.created_at) : undefined,
    updated_at: row.updated_at ? String(row.updated_at) : undefined,
  };
}

export function rowToPageSeoConfig(row: SitePageSeoRow): PageSeoConfig {
  const keywords = keywordsFromString(row.keywords);
  return {
    title: row.title,
    description: row.description,
    canonicalPath: row.canonical_path || row.page_path,
    keywords: keywords.length ? keywords : undefined,
    keyphrase: row.keyphrase || undefined,
    ogImage: row.og_image ? toSiteMediaUrl(row.og_image) : undefined,
    ogType: row.og_type,
    city: row.city || undefined,
    noindex: row.noindex,
  };
}

export function buildSitePageSeoInsert(body: any) {
  const page_path = normalizePagePath(body.page_path);
  const fallback = getDefaultSeoForPath(page_path);
  return {
    page_path,
    page_label: String(body.page_label || fallback?.page_label || page_path).trim(),
    title: String(body.title || fallback?.title || '').trim(),
    description: String(body.description || fallback?.description || '').trim(),
    keywords: keywordsToString(body.keywords ?? fallback?.keywords ?? ''),
    keyphrase: String(body.keyphrase ?? fallback?.keyphrase ?? '').trim(),
    og_image: String(body.og_image ?? '').trim(),
    canonical_path: normalizePagePath(body.canonical_path || fallback?.canonicalPath || page_path),
    og_type: String(body.og_type || fallback?.ogType || 'website').toLowerCase() === 'article' ? 'article' : 'website',
    city: String(body.city ?? fallback?.city ?? 'Mumbai').trim() || 'Mumbai',
    noindex: body.noindex === true || fallback?.noindex === true,
    active: body.active !== false,
    display_order: Number(body.display_order ?? fallback?.display_order ?? 0) || 0,
    notes: String(body.notes ?? '').trim(),
    updated_at: new Date().toISOString(),
  };
}

export function buildSitePageSeoUpdate(body: any) {
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.page_label !== undefined) updates.page_label = String(body.page_label || '').trim();
  if (body.title !== undefined) updates.title = String(body.title || '').trim();
  if (body.description !== undefined) updates.description = String(body.description || '').trim();
  if (body.keywords !== undefined) updates.keywords = keywordsToString(body.keywords);
  if (body.keyphrase !== undefined) updates.keyphrase = String(body.keyphrase || '').trim();
  if (body.og_image !== undefined) updates.og_image = String(body.og_image || '').trim();
  if (body.canonical_path !== undefined) updates.canonical_path = normalizePagePath(body.canonical_path);
  if (body.og_type !== undefined) {
    updates.og_type = String(body.og_type || 'website').toLowerCase() === 'article' ? 'article' : 'website';
  }
  if (body.city !== undefined) updates.city = String(body.city || 'Mumbai').trim() || 'Mumbai';
  if (body.noindex !== undefined) updates.noindex = body.noindex === true;
  if (body.active !== undefined) updates.active = body.active !== false;
  if (body.display_order !== undefined) updates.display_order = Number(body.display_order) || 0;
  if (body.notes !== undefined) updates.notes = String(body.notes || '').trim();
  return updates;
}

export function migrationHintForSitePageSeoError(message: string): string | null {
  const lower = String(message || '').toLowerCase();
  if (lower.includes('site_page_seo') && (lower.includes('does not exist') || lower.includes('relation'))) {
    return MIGRATION_269_HINT;
  }
  return null;
}

async function fetchPageSeoFromDbRaw(path: string): Promise<SitePageSeoRow | null> {
  const normalized = normalizePagePath(path);
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return null;

  const { data, error } = await supabaseAdmin
    .from(SITE_PAGE_SEO_TABLE)
    .select('*')
    .eq('page_path', normalized)
    .maybeSingle();

  if (error || !data) return null;
  const row = mapSitePageSeoRow(data);
  if (!row.active || !row.title.trim() || !row.description.trim()) return null;
  return row;
}

export async function getPageSeoForPath(path: string): Promise<SitePageSeoRow | null> {
  const normalized = normalizePagePath(path);
  return unstable_cache(
    async () => fetchPageSeoFromDbRaw(normalized),
    ['site-page-seo', normalized],
    { tags: ['site-page-seo', `site-page-seo:${normalized}`], revalidate: 300 },
  )();
}

export async function buildManagedPageMetadata(path: string): Promise<Metadata> {
  const normalized = normalizePagePath(path);
  const row = await getPageSeoForPath(normalized);
  if (row) return buildPageMetadata(rowToPageSeoConfig(row));

  const fallback = getDefaultSeoForPath(normalized);
  if (fallback) {
    const { page_path: _p, page_label: _l, display_order: _d, ...config } = fallback;
    return buildPageMetadata(config);
  }

  return buildPageMetadata({
    title: 'MyFNG - Car Service & Repairs',
    description: 'Book car service online at verified MYFNG workshops across Mumbai, Pune & Thane.',
    canonicalPath: normalized,
  });
}

export function classifySitePagePath(path: string): 'static' | 'service' | 'city' {
  if (isServicePagePath(path)) return 'service';
  if (isCityPagePath(path)) return 'city';
  return 'static';
}

export async function listSitePageSitemapEntries(): Promise<Array<{ path: string; lastModified?: Date }>> {
  const { supabaseAdmin } = getSupabaseAdmin();

  const ensureAlwaysIndexed = (
    entries: Array<{ path: string; lastModified?: Date }>,
  ): Array<{ path: string; lastModified?: Date }> => {
    const byPath = new Map<string, { path: string; lastModified?: Date }>();
    for (const entry of entries) {
      const path = normalizePagePath(entry.path);
      if (!path) continue;
      byPath.set(path, { ...entry, path });
    }

    // Always publish brand + legal pages even if missing/noindex in DB overrides.
    for (const brand of POPULAR_BRAND_PAGES) {
      const path = normalizePagePath(brand.pagePath);
      if (!byPath.has(path)) byPath.set(path, { path });
    }
    for (const path of ['/privacy-policy', '/terms-and-conditions']) {
      if (!byPath.has(path)) byPath.set(path, { path });
    }

    return [...byPath.values()];
  };

  if (!supabaseAdmin) {
    return ensureAlwaysIndexed(
      SITE_PAGE_SEO_DEFAULTS.filter((row) => !row.noindex).map((row) => ({
        path: row.canonicalPath || row.page_path,
      })),
    );
  }

  const { data, error } = await supabaseAdmin
    .from(SITE_PAGE_SEO_TABLE)
    .select('page_path, canonical_path, updated_at')
    .eq('active', true)
    .eq('noindex', false);

  if (error || !data?.length) {
    return ensureAlwaysIndexed(
      SITE_PAGE_SEO_DEFAULTS.filter((row) => !row.noindex).map((row) => ({
        path: row.canonicalPath || row.page_path,
      })),
    );
  }

  return ensureAlwaysIndexed(
    data.map((row: any) => ({
      path: normalizePagePath(row.canonical_path || row.page_path),
      lastModified: row.updated_at ? new Date(row.updated_at) : undefined,
    })),
  );
}

export function sortSitePageSeoRows<T extends { display_order?: number; page_path?: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const orderDiff = (Number(a.display_order) || 0) - (Number(b.display_order) || 0);
    if (orderDiff !== 0) return orderDiff;
    return String(a.page_path || '').localeCompare(String(b.page_path || ''));
  });
}
