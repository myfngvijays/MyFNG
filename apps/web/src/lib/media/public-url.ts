import { SITE_URL } from '@/lib/seo/metadata';

const SUPABASE_PUBLIC_STORAGE_SUFFIX = '/storage/v1/object/public/';

const DEFAULT_SITE_URL = 'https://myfng.in';

export function getSupabasePublicStorageBase(): string {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://cffommijlvicfjhbqyzk.supabase.co').replace(/\/$/, '');
  return `${base}${SUPABASE_PUBLIC_STORAGE_SUFFIX}`;
}

/** Convert Supabase public storage URL/path to a same-site media path. */
export function toSiteMediaPath(input: string): string {
  const value = String(input || '').trim();
  if (!value) return value;

  if (value.startsWith('/media/')) return value;

  if (value.startsWith(SITE_URL) || value.startsWith(DEFAULT_SITE_URL)) {
    const base = value.startsWith(SITE_URL) ? SITE_URL : DEFAULT_SITE_URL;
    const path = value.slice(base.length);
    return path.startsWith('/') ? path : `/${path}`;
  }

  if (value.startsWith('/') && !value.startsWith('//')) {
    return value;
  }

  const supabaseBase = getSupabasePublicStorageBase();
  if (value.startsWith(supabaseBase)) {
    const storagePath = value.slice(supabaseBase.length);
    return `/media/${storagePath.split('/').map((part) => decodeURIComponent(part)).join('/')}`;
  }

  if (!value.startsWith('http')) {
    return `/media/${value.replace(/^\/+/, '')}`;
  }

  return value;
}

/** Absolute myfng.in URL for SEO metadata, JSON-LD, and Open Graph. */
export function toSiteMediaUrl(input: string): string {
  const value = String(input || '').trim();
  if (!value) return value;

  if (value.startsWith('http://') || value.startsWith('https://')) {
    const path = toSiteMediaPath(value);
    if (path.startsWith('http')) return path;
    return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  }

  const path = toSiteMediaPath(value);
  const siteUrl = SITE_URL || DEFAULT_SITE_URL;
  return `${siteUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Relative path for <img src> and Next/Image on the website. */
export function toSiteMediaSrc(input: string): string {
  return toSiteMediaPath(input);
}

export const SERVICE_IMAGE_BASE_PATH = '/media/Service_image_public';

export function serviceImagePath(fileName: string): string {
  return `${SERVICE_IMAGE_BASE_PATH}/${fileName}`;
}

export function serviceImageUrl(fileName: string): string {
  return toSiteMediaUrl(serviceImagePath(fileName));
}
