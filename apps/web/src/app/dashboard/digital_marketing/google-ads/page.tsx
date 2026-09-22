'use client';

import dynamic from 'next/dynamic';
import DashboardLayout from '@/components/DashboardLayout';

const GoogleAdsMcpApp = dynamic(() => import('@/components/admin/google-ads-mcp/GoogleAdsMcpApp'), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[50vh] w-full items-center justify-center text-sm text-slate-500">
      Loading Google Ads…
    </div>
  ),
});

export default function DigitalMarketingGoogleAdsPage() {
  return (
    <DashboardLayout role="digital_marketing">
      <div className="-m-3 sm:-m-4 md:-m-5">
        <GoogleAdsMcpApp />
      </div>
    </DashboardLayout>
  );
}
