import { liveFileResponseHeaders, resolveLiveFileContent } from '@/lib/site-seo-live-files';

export const revalidate = 300;

export async function GET() {
  const body = await resolveLiveFileContent('robots_txt');
  return new Response(body, { headers: liveFileResponseHeaders('robots_txt') });
}
