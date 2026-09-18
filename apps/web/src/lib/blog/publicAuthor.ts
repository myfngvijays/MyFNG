/** Public + auto-post author. Daily / batch / RSA cron always publish under this name. */
export const PUBLIC_BLOG_AUTHOR = 'Nikhil Yelligetti';
export const PUBLIC_BLOG_AUTHOR_SLUG = 'nikhil-yelligetti';
export const PUBLIC_BLOG_AUTHOR_HREF = `/blogs/author/${PUBLIC_BLOG_AUTHOR_SLUG}`;
export const LEGACY_BLOG_AUTHOR_SLUGS = ['myfng-auto-expert'];

export function publicBlogAuthorName(_blog?: unknown): string {
  return PUBLIC_BLOG_AUTHOR;
}

export function publicBlogByline(_blog?: unknown): string {
  return PUBLIC_BLOG_AUTHOR;
}

export function isPublicBlogAuthorSlug(slug?: string | null) {
  const value = String(slug || '').trim().toLowerCase();
  return value === PUBLIC_BLOG_AUTHOR_SLUG || LEGACY_BLOG_AUTHOR_SLUGS.includes(value);
}

export function isLegacyBlogAuthorSlug(slug?: string | null) {
  return LEGACY_BLOG_AUTHOR_SLUGS.includes(String(slug || '').trim().toLowerCase());
}
