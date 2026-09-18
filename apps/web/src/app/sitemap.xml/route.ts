import { liveFileResponseHeaders, resolveLiveFileContent } from '@/lib/site-seo-live-files';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const body = await resolveLiveFileContent('sitemap_xml');
  return new Response(body, { headers: liveFileResponseHeaders('sitemap_xml') });
}
