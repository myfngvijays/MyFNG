import { readFile } from 'fs/promises';
import path from 'path';
import type { MetadataRoute } from 'next';
import { unstable_cache } from 'next/cache';
import { SITE_URL } from '@/lib/seo/metadata';
import { listSitePageSitemapEntries } from '@/lib/site-page-seo';
import {
  buildRobotsDisallowPaths,
  getSiteTechnicalSeo,
  type SiteTechnicalSeoRow,
} from '@/lib/site-technical-seo';
import { listBlogSitemapEntries, listWorkshopSitemapEntries } from '@/lib/workshop-page-seo';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export const SITE_SEO_LIVE_FILES_TABLE = 'site_seo_live_files';
export const SITE_SEO_LIVE_FILES_TAG = 'site-seo-live-files';

export const MIGRATION_274_HINT =
  'Run `database/274_site_seo_live_files.sql` for admin-editable live SEO files.';

export const LIVE_FILE_KEYS = [
  'sitemap_xml',
  'robots_txt',
  'manifest_json',
  'llms_txt',
  'security_txt',
  'humans_txt',
] as const;

export type LiveFileKey = (typeof LIVE_FILE_KEYS)[number];

export type LiveFileRow = {
  file_key: LiveFileKey;
  content: string;
  use_custom: boolean;
  updated_at?: string;
};

export type LiveFileAdminView = LiveFileRow & {
  label: string;
  url: string;
  content_type: string;
  generated_content: string;
};

export const LIVE_FILE_META: Record<
  LiveFileKey,
  { label: string; path: string; contentType: string }
> = {
  sitemap_xml: {
    label: 'Sitemap.xml',
    path: '/sitemap.xml',
    contentType: 'application/xml; charset=utf-8',
  },
  robots_txt: {
    label: 'Robots.txt',
    path: '/robots.txt',
    contentType: 'text/plain; charset=utf-8',
  },
  manifest_json: {
    label: 'Manifest',
    path: '/manifest.webmanifest',
    contentType: 'application/manifest+json; charset=utf-8',
  },
  llms_txt: {
    label: 'llms.txt',
    path: '/llms.txt',
    contentType: 'text/plain; charset=utf-8',
  },
  security_txt: {
    label: 'security.txt',
    path: '/.well-known/security.txt',
    contentType: 'text/plain; charset=utf-8',
  },
  humans_txt: {
    label: 'humans.txt',
    path: '/humans.txt',
    contentType: 'text/plain; charset=utf-8',
  },
};

function priorityForPath(pathname: string): number {
  if (pathname === '/') return 1;
  if (pathname === '/car-services' || pathname.startsWith('/car-services/')) return 0.9;
  if (pathname.startsWith('/car-service-in/')) return 0.85;
  if (pathname === '/book-service' || pathname === '/workshop-locator') return 0.8;
  if (pathname.startsWith('/workshop/')) return 0.75;
  if (pathname.startsWith('/blogs/')) return 0.65;
  if (pathname === '/blogs') return 0.8;
  return 0.7;
}

function changeFrequencyForPath(pathname: string): MetadataRoute.Sitemap[number]['changeFrequency'] {
  if (pathname === '/blogs' || pathname.startsWith('/blogs/')) return 'weekly';
  if (pathname.startsWith('/workshop/')) return 'weekly';
  if (pathname === '/') return 'weekly';
  return 'monthly';
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatSitemapDate(value?: Date | string | null): string {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

export async function buildGeneratedSitemapEntries(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const sitePages = await listSitePageSitemapEntries();

  const siteRoutes: MetadataRoute.Sitemap = sitePages.map((entry) => ({
    url: `${SITE_URL}${entry.path}`,
    lastModified: entry.lastModified || now,
    changeFrequency: changeFrequencyForPath(entry.path),
    priority: priorityForPath(entry.path),
  }));

  const [workshops, blogs] = await Promise.all([
    listWorkshopSitemapEntries(),
    listBlogSitemapEntries(),
  ]);

  const workshopRoutes: MetadataRoute.Sitemap = workshops.map((entry) => ({
    url: `${SITE_URL}/workshop/${entry.slug}`,
    lastModified: entry.lastModified || now,
    changeFrequency: 'weekly',
    priority: 0.75,
  }));

  const blogRoutes: MetadataRoute.Sitemap = blogs.map((entry) => ({
    url: `${SITE_URL}/blogs/${entry.slug}`,
    lastModified: entry.lastModified || now,
    changeFrequency: 'weekly',
    priority: 0.65,
  }));

  return [...siteRoutes, ...workshopRoutes, ...blogRoutes];
}

export async function generateSitemapXmlContent(): Promise<string> {
  const entries = await buildGeneratedSitemapEntries();
  const urls = entries
    .map((entry) => {
      const lastmod = formatSitemapDate(entry.lastModified);
      const changefreq = entry.changeFrequency || 'monthly';
      const priority =
        typeof entry.priority === 'number' ? entry.priority.toFixed(1) : String(entry.priority || '0.7');
      return `  <url>
    <loc>${escapeXml(entry.url)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
}

export async function generateRobotsTxtContent(settings?: SiteTechnicalSeoRow): Promise<string> {
  const resolved = settings || (await getSiteTechnicalSeo());
  const disallow = buildRobotsDisallowPaths(resolved);
  const lines = ['User-agent: *', 'Allow: /', ...disallow.map((item) => `Disallow: ${item}`), '', `Sitemap: ${SITE_URL}/sitemap.xml`];
  return `${lines.join('\n')}\n`;
}

export async function generateManifestJsonContent(settings?: SiteTechnicalSeoRow): Promise<string> {
  const resolved = settings || (await getSiteTechnicalSeo());
  const manifest = {
    name: resolved.manifest_name,
    short_name: resolved.manifest_short_name,
    description: resolved.manifest_description,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: resolved.theme_color || '#dc2626',
    lang: 'en-IN',
    orientation: 'portrait-primary',
    categories: ['automotive', 'business'],
    icons: [
      { src: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { src: '/app-download-popup.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  };
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

async function readPublicText(relativePath: string): Promise<string> {
  const filePath = path.join(process.cwd(), 'public', relativePath);
  try {
    return await readFile(filePath, 'utf8');
  } catch {
    return '';
  }
}

export async function generateSecurityTxtContent(settings?: SiteTechnicalSeoRow): Promise<string> {
  const resolved = settings || (await getSiteTechnicalSeo());
  const email = resolved.security_contact_email || 'support@myfng.in';
  const phone = resolved.security_contact_phone || '+91-8657575757';
  return `Contact: mailto:${email}
Contact: tel:${phone}
Expires: 2027-12-31T23:59:59.000Z
Preferred-Languages: en, hi
Canonical: ${SITE_URL}/.well-known/security.txt
Policy: ${SITE_URL}/privacy-policy
`;
}

export async function generateLlmsTxtContent(): Promise<string> {
  const fromPublic = await readPublicText('llms.txt');
  return fromPublic || '# My FNG\n';
}

export async function generateHumansTxtContent(): Promise<string> {
  const fromPublic = await readPublicText('humans.txt');
  return (
    fromPublic ||
    `/* TEAM */
Company: MYFNG - My Friendly Neighbourhood Garage
Site: ${SITE_URL}
Contact: support@myfng.in
`
  );
}

export async function generateLiveFileContent(key: LiveFileKey): Promise<string> {
  switch (key) {
    case 'sitemap_xml':
      return generateSitemapXmlContent();
    case 'robots_txt':
      return generateRobotsTxtContent();
    case 'manifest_json':
      return generateManifestJsonContent();
    case 'llms_txt':
      return generateLlmsTxtContent();
    case 'security_txt':
      return generateSecurityTxtContent();
    case 'humans_txt':
      return generateHumansTxtContent();
    default:
      return '';
  }
}

export function mapLiveFileRow(row: Record<string, unknown> | null | undefined): LiveFileRow | null {
  if (!row) return null;
  const fileKey = String(row.file_key || '') as LiveFileKey;
  if (!LIVE_FILE_KEYS.includes(fileKey)) return null;
  return {
    file_key: fileKey,
    content: String(row.content || ''),
    use_custom: row.use_custom === true,
    updated_at: row.updated_at ? String(row.updated_at) : undefined,
  };
}

async function fetchLiveFileOverrides(): Promise<Map<LiveFileKey, LiveFileRow>> {
  const { supabaseAdmin } = getSupabaseAdmin();
  const map = new Map<LiveFileKey, LiveFileRow>();
  if (!supabaseAdmin) return map;

  const { data, error } = await supabaseAdmin.from(SITE_SEO_LIVE_FILES_TABLE).select('*');
  if (error || !data) return map;

  for (const row of data) {
    const mapped = mapLiveFileRow(row);
    if (mapped) map.set(mapped.file_key, mapped);
  }
  return map;
}

export const getLiveFileOverrides = unstable_cache(fetchLiveFileOverrides, ['site-seo-live-files-overrides'], {
  tags: [SITE_SEO_LIVE_FILES_TAG],
  revalidate: 300,
});

export async function getLiveFileOverride(key: LiveFileKey): Promise<LiveFileRow | null> {
  const overrides = await getLiveFileOverrides();
  return overrides.get(key) || null;
}

export async function resolveLiveFileContent(key: LiveFileKey): Promise<string> {
  const override = await getLiveFileOverride(key);
  if (override?.use_custom && override.content.trim()) return override.content;
  return generateLiveFileContent(key);
}

export async function buildLiveFileAdminViews(): Promise<LiveFileAdminView[]> {
  const overrides = await getLiveFileOverrides();
  const views: LiveFileAdminView[] = [];

  for (const key of LIVE_FILE_KEYS) {
    const meta = LIVE_FILE_META[key];
    const override = overrides.get(key);
    const generated = await generateLiveFileContent(key);
    views.push({
      file_key: key,
      label: meta.label,
      url: `${SITE_URL}${meta.path}`,
      content_type: meta.contentType,
      content: override?.use_custom && override.content.trim() ? override.content : generated,
      use_custom: override?.use_custom === true,
      generated_content: generated,
      updated_at: override?.updated_at,
    });
  }

  return views;
}

export function migrationHintForLiveFilesError(message: string): string | undefined {
  return /site_seo_live_files/i.test(message) ? MIGRATION_274_HINT : undefined;
}

export function liveFileResponseHeaders(key: LiveFileKey): HeadersInit {
  return {
    'Content-Type': LIVE_FILE_META[key].contentType,
    'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
  };
}
