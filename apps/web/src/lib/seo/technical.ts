import type { Metadata, Viewport } from 'next';
import { DEFAULT_OG_IMAGE, SITE_NAME, SITE_URL } from '@/lib/seo/metadata';
import type { SiteTechnicalSeoRow } from '@/lib/site-technical-seo';

export const SITE_THEME_COLOR = '#dc2626';

export const defaultSiteViewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: SITE_THEME_COLOR,
};

export function buildUtilityPageMetadata(title: string, path: string): Metadata {
  const canonicalPath = path.startsWith('/') ? path : `/${path}`;
  return {
    title,
    robots: {
      index: false,
      follow: false,
      googleBot: { index: false, follow: false },
    },
    alternates: { canonical: `${SITE_URL}${canonicalPath}` },
  };
}

export function buildNotFoundMetadata(): Metadata {
  return {
    title: 'Page Not Found',
    description: 'The page you are looking for does not exist on MYFNG.',
    robots: {
      index: false,
      follow: false,
      googleBot: { index: false, follow: false },
    },
  };
}

export function buildRootOpenGraphDefaults(settings?: Pick<SiteTechnicalSeoRow, 'default_title' | 'default_description'>) {
  const title = settings?.default_title || "My FNG - India's First AI-Powered Car Service Booking Platform";
  const description =
    settings?.default_description ||
    "India's first AI-powered car service booking platform. Book periodic service, AC repair, engine service & more at verified workshops in Mumbai, Pune & Thane.";

  return {
    title,
    description,
    url: SITE_URL,
    siteName: SITE_NAME,
    locale: 'en_IN',
    type: 'website' as const,
    images: [{ url: DEFAULT_OG_IMAGE, alt: title }],
  };
}

export function buildRootTwitterDefaults(settings?: Pick<SiteTechnicalSeoRow, 'default_title' | 'default_description' | 'twitter_site'>) {
  const title = settings?.default_title || "My FNG - India's First AI-Powered Car Service Booking Platform";
  const description =
    settings?.default_description ||
    "India's first AI-powered car service booking platform. Book car service at verified MYFNG workshops across Mumbai, Pune & Thane.";

  return {
    card: 'summary_large_image' as const,
    title,
    description,
    images: [DEFAULT_OG_IMAGE],
    site: settings?.twitter_site || '@myfngcarservice',
  };
}

export function buildRootVerificationMetadata(settings?: Pick<
  SiteTechnicalSeoRow,
  'google_verification' | 'bing_verification' | 'yandex_verification'
>): Metadata['verification'] {
  const google = settings?.google_verification?.trim() || process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim();
  const bing = settings?.bing_verification?.trim() || process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION?.trim();
  const yandex = settings?.yandex_verification?.trim() || process.env.NEXT_PUBLIC_YANDEX_SITE_VERIFICATION?.trim();

  if (!google && !bing && !yandex) return undefined;

  return {
    ...(google ? { google } : {}),
    ...(bing ? { other: { 'msvalidate.01': bing } } : {}),
    ...(yandex ? { yandex } : {}),
  };
}
