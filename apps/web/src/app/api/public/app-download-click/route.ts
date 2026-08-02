import { NextRequest, NextResponse } from 'next/server';
import { logAppDownloadLinkClick } from '@/lib/app-download-link';
import { mergeUtmParams, parseUtmFromRequest } from '@/lib/utm';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const slug = String(body.slug || 'myfngapp').trim().toLowerCase();
  const platform = String(body.platform || 'desktop').trim().toLowerCase();
  const safePlatform =
    platform === 'ios' || platform === 'android' || platform === 'desktop' ? platform : 'desktop';

  const utm = mergeUtmParams(parseUtmFromRequest(request), body.utm || {});

  await logAppDownloadLinkClick({
    slug,
    platform: safePlatform,
    utm,
    userAgent: request.headers.get('user-agent'),
    referer: request.headers.get('referer'),
    redirectUrl: body.redirect_url ? String(body.redirect_url) : null,
  });

  return NextResponse.json({ success: true });
}
