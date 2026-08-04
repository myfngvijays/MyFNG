import { NextRequest, NextResponse } from 'next/server';
import { getLongUrl } from '@/lib/services/urlShortener';
import { resolveManagedShortLinkRedirect } from '@/lib/link-manager/service';

export async function GET(
  request: NextRequest,
  { params }: { params: { shortCode: string } },
) {
  try {
    const shortCode = params.shortCode;
    if (!shortCode || shortCode.length < 3) {
      return NextResponse.redirect(new URL('/', request.url));
    }

    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      null;
    const userAgent = request.headers.get('user-agent');
    const referrer = request.headers.get('referer');

    const managedUrl = await resolveManagedShortLinkRedirect(shortCode, {
      ip,
      userAgent,
      referrer,
    });
    if (managedUrl) {
      return NextResponse.redirect(new URL(managedUrl, request.url));
    }

    const legacyUrl = await getLongUrl(shortCode);
    if (legacyUrl) {
      return NextResponse.redirect(new URL(legacyUrl, request.url));
    }

    return NextResponse.redirect(new URL('/', request.url));
  } catch (error) {
    console.error('Error in short URL redirect:', error);
    return NextResponse.redirect(new URL('/', request.url));
  }
}
