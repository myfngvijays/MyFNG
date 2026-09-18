import { revalidatePath, revalidateTag } from 'next/cache';

export function revalidatePublicSitemap() {
  revalidateTag('blog-sitemap');
  revalidateTag('workshop-sitemap');
  revalidateTag('site-page-sitemap');
  revalidateTag('site-seo-live-files');
  revalidatePath('/sitemap.xml');
}

export function revalidateBlogSeo(slug?: string) {
  revalidatePublicSitemap();
  if (slug) revalidateTag(`blog-seo:${slug.trim().toLowerCase()}`);
}

export function revalidateWorkshopSeo(slug?: string) {
  revalidateTag('workshop-page-seo');
  revalidatePublicSitemap();
  if (slug) revalidateTag(`workshop-page-seo:${slug.trim().toLowerCase()}`);
}

export function revalidateSitePageSeo(path?: string) {
  revalidateTag('site-page-seo');
  revalidatePublicSitemap();
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
