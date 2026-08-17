import { buildAppleAppSiteAssociation } from '@/lib/app-association';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** iOS Universal Links — must be served as application/json with no redirects. */
export async function GET() {
  const body = JSON.stringify(buildAppleAppSiteAssociation());
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
