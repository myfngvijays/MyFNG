import { toSiteMediaPath, toSiteMediaUrl } from '@/lib/media/public-url';

const SUPABASE_PUBLIC_STORAGE_RE =
  /https?:\/\/[^"'\s]+\.supabase\.co\/storage\/v1\/object\/public\//gi;

export function normalizeBlogMediaUrl(input: string | null | undefined): string | null {
  const value = String(input || '').trim();
  if (!value) return null;
  return toSiteMediaPath(value);
}

/** Absolute myfng.in URL for Open Graph / JSON-LD. */
export function normalizeBlogMediaAbsoluteUrl(input: string | null | undefined): string | undefined {
  const value = String(input || '').trim();
  if (!value) return undefined;
  return toSiteMediaUrl(value);
}

export function normalizeBlogHtmlMedia(html: string): string {
  const value = String(html || '');
  if (!value) return value;
  return value.replace(SUPABASE_PUBLIC_STORAGE_RE, '/media/');
}

export function normalizeBlogSeoData(seo: Record<string, unknown> | null | undefined) {
  if (!seo || typeof seo !== 'object') return seo;
  const next = { ...seo } as Record<string, unknown>;
  if (typeof next.og_image === 'string' && next.og_image.trim()) {
    next.og_image = normalizeBlogMediaUrl(next.og_image);
  }
  return next;
}

export function normalizeBlogRecordForResponse<T extends Record<string, unknown>>(blog: T): T {
  return {
    ...blog,
    featured_image: blog.featured_image
      ? normalizeBlogMediaUrl(String(blog.featured_image))
      : blog.featured_image,
    content: blog.content ? normalizeBlogHtmlMedia(String(blog.content)) : blog.content,
    seo_data: normalizeBlogSeoData(blog.seo_data as Record<string, unknown> | null | undefined),
  };
}
