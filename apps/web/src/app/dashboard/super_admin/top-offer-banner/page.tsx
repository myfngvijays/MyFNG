'use client';

import dynamic from 'next/dynamic';

const TopOfferBannerAdmin = dynamic(() => import('@/components/admin/top-offer-banner/TopOfferBannerAdmin'), {
  ssr: false,
});

export default function TopOfferBannerPage() {
  return <TopOfferBannerAdmin />;
}
