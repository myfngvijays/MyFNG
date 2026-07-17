import { unstable_cache } from 'next/cache';
import type { Metadata, Viewport } from 'next';
import { DEFAULT_OG_IMAGE, SITE_NAME, SITE_URL } from '@/lib/seo/metadata';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export const SITE_TECHNICAL_SEO_TABLE = 'site_technical_seo';
export const SITE_TECHNICAL_SEO_KEY = 'default';
export const SITE_TECHNICAL_SEO_TAG = 'site-technical-seo';

export const MIGRATION_273_HINT =
  'Run `database/273_site_technical_seo.sql` for admin-managed technical SEO settings.';

export type SiteTechnicalSeoRow = {
  config_key: string;
  google_verification: string;
  bing_verification: string;
  yandex_verification: string;
  default_title: string;
  default_description: string;
  twitter_site: string;
  theme_color: string;
  manifest_name: string;
  manifest_short_name: string;
  manifest_description: string;
  organization_same_as: string;
  extra_robots_disallow: string;
  security_contact_email: string;
  security_contact_phone: string;
  notes: string;
  updated_at?: string;
};

export const DEFAULT_UTILITY_NOINDEX_PATHS = [
  '/booking-success',
  '/pay-now',
  '/book-service/details',
  '/workshop-chat',
  '/customer/*',
] as const;

export const DEFAULT_ROBOTS_DISALLOW_PATHS = [
  '/dashboard/',
  '/api/',
  '/booking-success',
  '/pay-now',
  '/book-service/details',
  '/customer/',
  '/workshop-chat',
  '/ai-experience',
] as const;

export const DEFAULT_ORGANIZATION_SAME_AS = [
  'https://www.facebook.com/myfng',
  'https://www.instagram.com/myfng',
  'https://www.linkedin.com/company/myfng',
  'https://x.com/myfngcarservice',
  'https://www.youtube.com/@myfng_car_servicing',
];

export const SITE_TECHNICAL_SEO_DEFAULTS: SiteTechnicalSeoRow = {
  config_key: SITE_TECHNICAL_SEO_KEY,
  google_verification: '',
  bing_verification: '',
  yandex_verification: '',
  default_title: "My FNG - India's First AI-Powered Car Service Booking Platform",
  default_description:
    "India's first AI-powered car service booking platform. Book periodic service, AC repair, engine service & more at verified workshops in Mumbai, Pune & Thane.",
  twitter_site: '@myfngcarservice',
  theme_color: '#dc2626',
  manifest_name: 'MYFNG - Car Service & Repairs',
  manifest_short_name: 'MYFNG',
  manifest_description:
    'Book car service online at verified MYFNG workshops across Mumbai, Pune, Thane and Navi Mumbai.',
  organization_same_as: DEFAULT_ORGANIZATION_SAME_AS.join('\n'),
  extra_robots_disallow: '',
  security_contact_email: 'support@myfng.in',
  security_contact_phone: '+91-8657575757',
  notes: '',
};

export function parseMultilineList(raw: string): string[] {
  return String(raw || '')
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseSameAsUrls(raw: string): string[] {
  const urls = parseMultilineList(raw).filter((url) => /^https?:\/\//i.test(url));
  return urls.length ? urls : DEFAULT_ORGANIZATION_SAME_AS;
}

export function mapSiteTechnicalSeoRow(row: Record<string, unknown> | null | undefined): SiteTechnicalSeoRow {
  if (!row) return { ...SITE_TECHNICAL_SEO_DEFAULTS };
  return {
    config_key: String(row.config_key || SITE_TECHNICAL_SEO_KEY),
    google_verification: String(row.google_verification || '').trim(),
    bing_verification: String(row.bing_verification || '').trim(),
    yandex_verification: String(row.yandex_verification || '').trim(),
    default_title: String(row.default_title || SITE_TECHNICAL_SEO_DEFAULTS.default_title).trim(),
    default_description: String(row.default_description || SITE_TECHNICAL_SEO_DEFAULTS.default_description).trim(),
    twitter_site: String(row.twitter_site || SITE_TECHNICAL_SEO_DEFAULTS.twitter_site).trim(),
    theme_color: String(row.theme_color || SITE_TECHNICAL_SEO_DEFAULTS.theme_color).trim(),
    manifest_name: String(row.manifest_name || SITE_TECHNICAL_SEO_DEFAULTS.manifest_name).trim(),
    manifest_short_name: String(row.manifest_short_name || SITE_TECHNICAL_SEO_DEFAULTS.manifest_short_name).trim(),
    manifest_description: String(
      row.manifest_description || SITE_TECHNICAL_SEO_DEFAULTS.manifest_description,
    ).trim(),
    organization_same_as: String(row.organization_same_as || SITE_TECHNICAL_SEO_DEFAULTS.organization_same_as),
    extra_robots_disallow: String(row.extra_robots_disallow || ''),
    security_contact_email: String(
      row.security_contact_email || SITE_TECHNICAL_SEO_DEFAULTS.security_contact_email,
    ).trim(),
    security_contact_phone: String(
      row.security_contact_phone || SITE_TECHNICAL_SEO_DEFAULTS.security_contact_phone,
    ).trim(),
    notes: String(row.notes || ''),
    updated_at: row.updated_at ? String(row.updated_at) : undefined,
  };
}

export function buildSiteTechnicalSeoUpdate(body: Record<string, unknown>) {
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const fields = [
    'google_verification',
    'bing_verification',
    'yandex_verification',
    'default_title',
    'default_description',
    'twitter_site',
    'theme_color',
    'manifest_name',
    'manifest_short_name',
    'manifest_description',
    'organization_same_as',
    'extra_robots_disallow',
    'security_contact_email',
    'security_contact_phone',
    'notes',
  ] as const;

  for (const field of fields) {
    if (body[field] !== undefined) updates[field] = String(body[field] ?? '');
  }

  return updates;
}

export function migrationHintForSiteTechnicalSeoError(message: string): string | undefined {
  return /site_technical_seo/i.test(message) ? MIGRATION_273_HINT : undefined;
}

function envFallbackSettings(): SiteTechnicalSeoRow {
  const settings = { ...SITE_TECHNICAL_SEO_DEFAULTS };
  const google = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim();
  const bing = process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION?.trim();
  const yandex = process.env.NEXT_PUBLIC_YANDEX_SITE_VERIFICATION?.trim();
  if (google) settings.google_verification = google;
  if (bing) settings.bing_verification = bing;
  if (yandex) settings.yandex_verification = yandex;
  return settings;
}

async function fetchSiteTechnicalSeo(): Promise<SiteTechnicalSeoRow> {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return envFallbackSettings();

  const { data, error } = await supabaseAdmin
    .from(SITE_TECHNICAL_SEO_TABLE)
    .select('*')
    .eq('config_key', SITE_TECHNICAL_SEO_KEY)
    .maybeSingle();

  if (error || !data) return envFallbackSettings();
  return mapSiteTechnicalSeoRow(data);
}

export const getSiteTechnicalSeo = unstable_cache(fetchSiteTechnicalSeo, ['site-technical-seo'], {
  tags: [SITE_TECHNICAL_SEO_TAG],
  revalidate: 300,
});

export function buildVerificationMetadata(settings: SiteTechnicalSeoRow): Metadata['verification'] {
  const google =
    settings.google_verification.trim() || process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim() || '';
  const bing =
    settings.bing_verification.trim() || process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION?.trim() || '';
  const yandex =
    settings.yandex_verification.trim() || process.env.NEXT_PUBLIC_YANDEX_SITE_VERIFICATION?.trim() || '';
  if (!google && !bing && !yandex) return undefined;
  return {
    ...(google ? { google } : {}),
    ...(bing ? { other: { 'msvalidate.01': bing } } : {}),
    ...(yandex ? { yandex } : {}),
  };
}

export function buildRootOpenGraphFromSettings(settings: SiteTechnicalSeoRow) {
  return {
    title: settings.default_title,
    description: settings.default_description,
    url: SITE_URL,
    siteName: SITE_NAME,
    locale: 'en_IN',
    type: 'website' as const,
    images: [{ url: DEFAULT_OG_IMAGE, alt: settings.default_title }],
  };
}

export function buildRootTwitterFromSettings(settings: SiteTechnicalSeoRow) {
  return {
    card: 'summary_large_image' as const,
    title: settings.default_title,
    description: settings.default_description,
    images: [DEFAULT_OG_IMAGE],
    site: settings.twitter_site || '@myfngcarservice',
  };
}

export function buildRootMetadataFromSettings(settings: SiteTechnicalSeoRow): Metadata {
  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: settings.default_title,
      template: '%s | MyFNG',
    },
    description: settings.default_description,
    keywords: [
      'car service near me',
      'car repair near me',
      'best mechanic near me',
      'car servicing Mumbai',
      'car servicing Pune',
      'MYFNG',
    ],
    authors: [{ name: 'MYFNG' }],
    creator: 'MYFNG',
    publisher: 'MYFNG',
    formatDetection: {
      email: false,
      address: false,
      telephone: false,
    },
    icons: {
      icon: [
        { url: '/favicon.ico' },
        { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      ],
      apple: [{ url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' }],
      shortcut: ['/favicon.ico'],
    },
    openGraph: buildRootOpenGraphFromSettings(settings),
    twitter: buildRootTwitterFromSettings(settings),
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
    },
    verification: buildVerificationMetadata(settings),
    alternates: {
      canonical: SITE_URL,
      types: {
        'application/rss+xml': `${SITE_URL}/blogs/feed.xml`,
        'text/plain': `${SITE_URL}/llms.txt`,
      },
    },
    other: {
      'msapplication-TileColor': settings.theme_color || '#dc2626',
    },
  };
}

export function buildSiteViewportFromSettings(settings: SiteTechnicalSeoRow): Viewport {
  return {
    width: 'device-width',
    initialScale: 1,
    themeColor: settings.theme_color || '#dc2626',
  };
}

export function buildRobotsDisallowPaths(settings: SiteTechnicalSeoRow): string[] {
  const extra = parseMultilineList(settings.extra_robots_disallow).map((path) =>
    path.startsWith('/') ? path : `/${path}`,
  );
  return [...DEFAULT_ROBOTS_DISALLOW_PATHS, ...extra];
}

export type TechnicalSeoOverview = {
  sitemap_url: string;
  robots_url: string;
  manifest_url: string;
  llms_txt_url: string;
  security_txt_url: string;
  humans_txt_url: string;
  rss_feed_url: string;
  url_counts: {
    site_pages: number;
    workshops: number;
    blogs: number;
    total: number;
  };
  robots_disallow: string[];
  utility_noindex: string[];
  json_ld_pages: Array<{ label: string; schema: string }>;
};

export function buildTechnicalSeoOverview(counts: {
  site_pages: number;
  workshops: number;
  blogs: number;
}): TechnicalSeoOverview {
  return {
    sitemap_url: `${SITE_URL}/sitemap.xml`,
    robots_url: `${SITE_URL}/robots.txt`,
    manifest_url: `${SITE_URL}/manifest.webmanifest`,
    llms_txt_url: `${SITE_URL}/llms.txt`,
    security_txt_url: `${SITE_URL}/.well-known/security.txt`,
    humans_txt_url: `${SITE_URL}/humans.txt`,
    rss_feed_url: `${SITE_URL}/blogs/feed.xml`,
    url_counts: {
      site_pages: counts.site_pages,
      workshops: counts.workshops,
      blogs: counts.blogs,
      total: counts.site_pages + counts.workshops + counts.blogs,
    },
    robots_disallow: [...DEFAULT_ROBOTS_DISALLOW_PATHS],
    utility_noindex: [...DEFAULT_UTILITY_NOINDEX_PATHS],
    json_ld_pages: [
      { label: 'Home', schema: 'Organization, WebSite, LocalBusiness' },
      { label: 'About', schema: 'Organization' },
      { label: 'FAQs', schema: 'FAQPage (from public FAQs)' },
      { label: 'Contact', schema: 'ContactPage' },
      { label: 'Book Service', schema: 'WebPage' },
      { label: 'MISA AI', schema: 'WebApplication' },
      { label: 'Roadside Assistance', schema: 'Service' },
      { label: 'Car Services', schema: 'CollectionPage' },
      { label: 'Workshops', schema: 'AutoRepair + BreadcrumbList' },
      { label: 'Blogs', schema: 'Article + FAQ (when enabled)' },
      { label: 'City Pages', schema: 'CollectionPage + LocalBusiness' },
    ],
  };
}
