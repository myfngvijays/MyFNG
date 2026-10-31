import { NextResponse } from 'next/server';
import { getWebsiteOfferPopup, isWebsiteOfferPopupLive, websiteOfferPopupHref } from '@/lib/website-offer-popup';

export const dynamic = 'force-dynamic';

export async function GET() {
  const config = await getWebsiteOfferPopup();
  if (!isWebsiteOfferPopupLive(config)) {
    return NextResponse.json({ popup: null });
  }
  return NextResponse.json({
    popup: {
      ...config,
      href: websiteOfferPopupHref(config),
    },
  });
}
