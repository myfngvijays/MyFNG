import { buildAndroidAssetLinks, getAndroidAppLinkFingerprints } from '@/lib/app-association';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 0;

/**
 * Android App Links verification.
 * Set ANDROID_APP_LINK_SHA256 (comma-separated Play App Signing SHA-256) in env.
 */
export async function GET() {
  const links = buildAndroidAssetLinks();
  const fingerprints = getAndroidAppLinkFingerprints();
  return new Response(JSON.stringify(links), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300',
      'X-MyFNG-App-Link-Fingerprints': String(fingerprints.length),
    },
  });
}
