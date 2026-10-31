import { NextRequest, NextResponse } from 'next/server';
import { getWebsiteOfferPopups, pickLiveWebsiteOfferPopup, websiteOfferPopupHref } from '@/lib/website-offer-popup';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get('path') || '/';
  const popups = await getWebsiteOfferPopups();
  const popup = pickLiveWebsiteOfferPopup(popups, path);
  if (!popup) return NextResponse.json({ popup: null });
  return NextResponse.json({
    popup: {
      ...popup,
      href: websiteOfferPopupHref(popup),
    },
  });
}
