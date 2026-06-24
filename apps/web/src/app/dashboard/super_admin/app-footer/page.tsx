'use client';

import dynamic from 'next/dynamic';

const AppFooterAdminApp = dynamic(() => import('@/components/admin/app-footer/AppFooterAdminApp'), {
  ssr: false,
});

export default function AppFooterAdminPage() {
  return <AppFooterAdminApp />;
}
