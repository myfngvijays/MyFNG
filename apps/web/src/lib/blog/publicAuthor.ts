export const PUBLIC_BLOG_AUTHOR = 'MyFNG Auto Expert';
export const PUBLIC_BLOG_AUTHOR_SLUG = 'myfng-auto-expert';
export const PUBLIC_BLOG_AUTHOR_HREF = `/blogs/author/${PUBLIC_BLOG_AUTHOR_SLUG}`;

export function publicBlogAuthorName(_blog?: unknown): string {
  return PUBLIC_BLOG_AUTHOR;
}

export function isPublicBlogAuthorSlug(slug?: string | null) {
  return String(slug || '').trim().toLowerCase() === PUBLIC_BLOG_AUTHOR_SLUG;
}
