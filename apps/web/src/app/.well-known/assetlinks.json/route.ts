import { buildAndroidAssetLinks } from '@/lib/app-association';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Android App Links verification file. */
export async function GET() {
  const body = JSON.stringify(buildAndroidAssetLinks());
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
