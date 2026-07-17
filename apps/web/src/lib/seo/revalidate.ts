import { revalidateTag } from 'next/cache';

export function revalidateBlogSeo(slug?: string) {
  revalidateTag('blog-sitemap');
  if (slug) revalidateTag(`blog-seo:${slug.trim().toLowerCase()}`);
}

export function revalidateWorkshopSeo(slug?: string) {
  revalidateTag('workshop-page-seo');
  revalidateTag('workshop-sitemap');
  if (slug) revalidateTag(`workshop-page-seo:${slug.trim().toLowerCase()}`);
}

export function revalidateSitePageSeo(path?: string) {
  revalidateTag('site-page-seo');
  revalidateTag('site-page-sitemap');
  if (path) {
    const normalized = path.startsWith('/') ? path : `/${path}`;
    revalidateTag(`site-page-seo:${normalized}`);
  }
}

export function revalidatePublicFaqSeo() {
  revalidateTag('public-faq-seo');
}

export function revalidateTechnicalSeo() {
  revalidateTag('site-technical-seo');
  revalidateTag('site-seo-live-files');
}

export function revalidateLiveFiles() {
  revalidateTag('site-seo-live-files');
}
