'use client';

import dynamic from 'next/dynamic';

const CompetitorIntelApp = dynamic(() => import('@/components/admin/competitor-intel/CompetitorIntelApp'), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-full w-full items-center justify-center bg-gradient-to-br from-slate-50 via-orange-50/40 to-amber-50/30 text-sm text-slate-500">
      Loading Competitors…
    </div>
  ),
});

export default function SuperAdminCompetitorsPage() {
  return (
    <div className="min-h-full w-full">
      <CompetitorIntelApp />
    </div>
  );
}
