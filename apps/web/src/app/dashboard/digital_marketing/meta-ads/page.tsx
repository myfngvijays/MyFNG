'use client';

import dynamic from 'next/dynamic';
import DashboardLayout from '@/components/DashboardLayout';

const MetaAdsMcpApp = dynamic(() => import('@/components/admin/meta-ads-mcp/MetaAdsMcpApp'), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[50vh] w-full items-center justify-center text-sm text-slate-500">
      Loading Meta Ads…
    </div>
  ),
});

export default function DigitalMarketingMetaAdsPage() {
  return (
    <DashboardLayout role="digital_marketing">
      <div className="-m-3 sm:-m-4 md:-m-5">
        <MetaAdsMcpApp />
      </div>
    </DashboardLayout>
  );
}
