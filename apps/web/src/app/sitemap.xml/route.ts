import { liveFileResponseHeaders, resolveLiveFileContent } from '@/lib/site-seo-live-files';

export const revalidate = 3600;

export async function GET() {
  const body = await resolveLiveFileContent('sitemap_xml');
  return new Response(body, { headers: liveFileResponseHeaders('sitemap_xml') });
}
