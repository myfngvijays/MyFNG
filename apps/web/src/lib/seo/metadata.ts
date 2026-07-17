import type { Metadata } from 'next';
import { toSiteMediaUrl } from '@/lib/media/public-url';

export const SITE_URL = 'https://myfng.in';
export const SITE_NAME = 'MYFNG - Car Service & Repairs in India';
export const DEFAULT_OG_IMAGE = `${SITE_URL}/app-download-popup.png`;

export type PageSeoConfig = {
  title: string;
  description: string;
  canonicalPath: string;
  keywords?: string | string[];
  keyphrase?: string;
  ogImage?: string;
  ogType?: 'website' | 'article';
  city?: string;
  noindex?: boolean;
};

export function buildPageMetadata(config: PageSeoConfig): Metadata {
  const canonicalPath = config.canonicalPath.startsWith('/')
    ? config.canonicalPath
    : `/${config.canonicalPath}`;
  const canonical = `${SITE_URL}${canonicalPath}`;
  const keywords = Array.isArray(config.keywords)
    ? config.keywords.join(', ')
    : config.keywords;
  const ogImage = toSiteMediaUrl(config.ogImage || DEFAULT_OG_IMAGE);
  const city = config.city || 'India';

  return {
    title: config.title,
    description: config.description,
    keywords: keywords || undefined,
    metadataBase: new URL(SITE_URL),
    alternates: { canonical },
    robots: {
      index: !config.noindex,
      follow: true,
      googleBot: { index: !config.noindex, follow: true },
    },
    openGraph: {
      title: config.title,
      description: config.description,
      url: canonical,
      siteName: SITE_NAME,
      locale: 'en_IN',
      type: config.ogType || 'website',
      images: [{ url: ogImage, alt: config.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: config.title,
      description: config.description,
      images: [ogImage],
    },
    other: {
      ...(config.keyphrase ? { keyphrase: config.keyphrase } : {}),
      author: 'MYFNG',
      copyright: `MYFNG - Best Car Service & Repairs in ${city}`,
      rating: 'general',
      distribution: 'Global',
      'revisit-after': '7 days',
    },
  };
}
