import { NextRequest, NextResponse } from 'next/server';
import { getLongUrl } from '@/lib/services/urlShortener';
import { resolveManagedShortLink } from '@/lib/link-manager/resolve';
import { appBaseUrl, isQrScanTrackingParam, sanitizePublicRedirectUrl } from '@/lib/link-manager/utils';
import { parseUtmParams } from '@/lib/utm';

function readUnlockCookie(request: NextRequest, shortCode: string): boolean {
  const raw = request.cookies.get(`sl_unlock_${shortCode}`)?.value;
  return raw === '1';
}

export async function handleManagedShortLinkRequest(
  request: NextRequest,
  shortCode: string,
  options?: { isQrScan?: boolean },
) {
  try {
    if (!shortCode || shortCode.length < 3) {
      return NextResponse.redirect(sanitizePublicRedirectUrl('/'));
    }

    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      null;
    const userAgent = request.headers.get('user-agent');
    const referrer = request.headers.get('referer');
    const isQrScan = Boolean(options?.isQrScan) || isQrScanTrackingParam(request.nextUrl.searchParams);

    const result = await resolveManagedShortLink(shortCode, {
      ip,
      userAgent,
      referrer,
      queryUtm: parseUtmParams(request.nextUrl.search),
      isQrScan,
      headers: request.headers,
      passwordUnlocked: readUnlockCookie(request, shortCode),
    });

    if (result?.kind === 'redirect') {
      return NextResponse.redirect(sanitizePublicRedirectUrl(result.url));
    }

    if (result?.kind === 'gone') {
      return NextResponse.redirect(sanitizePublicRedirectUrl(result.url));
    }

    if (result?.kind === 'gate') {
      const url = new URL(`/l/${encodeURIComponent(shortCode)}`, appBaseUrl());
      if (isQrScan) url.searchParams.set('via', 'qr');
      if (result.unlocked) url.searchParams.set('unlocked', '1');
      request.nextUrl.searchParams.forEach((value, key) => {
        if (key.startsWith('utm_')) url.searchParams.set(key, value);
      });
      return NextResponse.redirect(url);
    }

    const legacyUrl = await getLongUrl(shortCode);
    if (legacyUrl) {
      return NextResponse.redirect(sanitizePublicRedirectUrl(legacyUrl));
    }

    return NextResponse.redirect(sanitizePublicRedirectUrl('/'));
  } catch (error) {
    console.error('Error in short URL redirect:', error);
    return NextResponse.redirect(sanitizePublicRedirectUrl('/'));
  }
}
