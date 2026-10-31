'use client';

import dynamic from 'next/dynamic';

const WebsitePopupAdmin = dynamic(() => import('@/components/admin/website-popup/WebsitePopupAdmin'), {
  ssr: false,
});

export default function WebsitePopupPage() {
  return <WebsitePopupAdmin />;
}
