'use client';

import dynamic from 'next/dynamic';
import DashboardLayout from '@/components/DashboardLayout';

const SiteSeoAdminApp = dynamic(() => import('@/components/admin/site-seo/SiteSeoAdminApp'), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[50vh] w-full items-center justify-center text-sm text-slate-500">
      Loading on-page SEO…
    </div>
  ),
});

export default function DigitalMarketingSiteSeoPage() {
  return (
    <DashboardLayout role="digital_marketing">
      <div className="-m-3 sm:-m-4 md:-m-5">
        <SiteSeoAdminApp />
      </div>
    </DashboardLayout>
  );
}
