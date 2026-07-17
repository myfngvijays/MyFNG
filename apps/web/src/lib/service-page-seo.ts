import type { Metadata } from 'next';
import {
  DEFAULT_SERVICES,
  findServiceBySlug,
  INTERNAL_SLUG_TO_MARKETING,
  makeShortDescription,
  MARKETING_SLUG_TO_INTERNAL,
} from '@/lib/services/catalog';
import { buildPageMetadata, SITE_URL, type PageSeoConfig } from '@/lib/seo/metadata';
import { toSiteMediaUrl } from '@/lib/media/public-url';
import { getPageSeoForPath, rowToPageSeoConfig, type SitePageSeoSeed } from '@/lib/site-page-seo';

export function buildServicePagePath(marketingSlug: string): string {
  return `/car-services/${marketingSlug}`;
}

export function isServicePagePath(path: string): boolean {
  return path.startsWith('/car-services/') && path !== '/car-services';
}

export function getMarketingSlugFromServicePath(path: string): string | null {
  if (!isServicePagePath(path)) return null;
  return path.replace(/^\/car-services\//, '').split('/')[0] || null;
}

export function buildServicePageSeoFallback(marketingSlug: string): PageSeoConfig | null {
  const internalSlug = MARKETING_SLUG_TO_INTERNAL[marketingSlug];
  const service = internalSlug ? findServiceBySlug(internalSlug) : null;
  if (!service) return null;

  const description = makeShortDescription(service.longDescription) || service.description;
  const ogImage = toSiteMediaUrl(service.image);

  return {
    title: `${service.title} | MyFNG`,
    description,
    keywords: [
      service.title.toLowerCase(),
      `${service.title} near me`,
      'car service Mumbai',
      'car service Pune',
      'MYFNG',
    ],
    keyphrase: `${service.title} near me`,
    canonicalPath: buildServicePagePath(marketingSlug),
    ogImage,
    city: 'Mumbai',
  };
}

export const SERVICE_PAGE_SEO_DEFAULTS: SitePageSeoSeed[] = DEFAULT_SERVICES.map((service, index) => {
  const marketingSlug = INTERNAL_SLUG_TO_MARKETING[service.slug];
  const fallback = buildServicePageSeoFallback(marketingSlug);
  return {
    page_path: buildServicePagePath(marketingSlug),
    page_label: service.title,
    display_order: 100 + index + 1,
    title: fallback?.title || `${service.title} | MyFNG`,
    description: fallback?.description || service.description,
    keywords: fallback?.keywords || [service.title.toLowerCase(), 'MYFNG'],
    keyphrase: fallback?.keyphrase,
    canonicalPath: buildServicePagePath(marketingSlug),
    ogImage: fallback?.ogImage,
    city: 'Mumbai',
  };
});

export async function buildManagedServicePageMetadata(marketingSlug: string): Promise<Metadata> {
  const path = buildServicePagePath(marketingSlug);
  const row = await getPageSeoForPath(path);
  if (row) return buildPageMetadata(rowToPageSeoConfig(row));

  const fallback = buildServicePageSeoFallback(marketingSlug);
  if (fallback) return buildPageMetadata(fallback);

  return {};
}
