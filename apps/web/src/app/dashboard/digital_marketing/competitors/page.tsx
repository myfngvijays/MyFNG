'use client';

import dynamic from 'next/dynamic';
import DashboardLayout from '@/components/DashboardLayout';

const CompetitorIntelApp = dynamic(() => import('@/components/admin/competitor-intel/CompetitorIntelApp'), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[50vh] w-full items-center justify-center text-sm text-slate-500">
      Loading Competitors…
    </div>
  ),
});

export default function DigitalMarketingCompetitorsPage() {
  return (
    <DashboardLayout role="digital_marketing">
      <div className="-m-3 sm:-m-4 md:-m-5">
        <CompetitorIntelApp />
      </div>
    </DashboardLayout>
  );
}
