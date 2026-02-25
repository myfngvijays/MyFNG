import type { MetadataRoute } from 'next';
import { DEFAULT_SERVICES } from '@/lib/services/catalog';

const SITE_URL = 'https://myfng.in';

const INTERNAL_TO_MARKETING: Record<string, string> = {
  'periodic-service': 'periodic-car-service',
  'engine-service': 'car-engine-service',
  'ac-service': 'car-ac-service',
  'battery-service': 'car-battery',
  'brake-service': 'car-brake-service',
  'clutch-service': 'car-clutch-service',
  'tyre-wheel-care': 'tyre-wheel-care',
  'detailing-service': 'car-detailing-service',
  'denting-painting': 'car-denting-painting',
};

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const coreRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE_URL}/services`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE_URL}/book-service`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE_URL}/contact`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE_URL}/blogs`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${SITE_URL}/car-roadside-assitance`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
  ];

  const canonicalServiceRoutes: MetadataRoute.Sitemap = DEFAULT_SERVICES
    .map((service) => {
      const marketingSlug = INTERNAL_TO_MARKETING[service.slug];
      if (!marketingSlug) return null;

      return {
        url: `${SITE_URL}/car-services/${marketingSlug}`,
        lastModified: now,
        changeFrequency: 'weekly' as const,
        priority: 0.9,
      };
    })
    .filter(Boolean) as MetadataRoute.Sitemap;

  return [...coreRoutes, ...canonicalServiceRoutes];
}
