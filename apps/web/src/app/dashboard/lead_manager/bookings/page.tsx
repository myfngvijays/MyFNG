'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import SuperAdminBookingsPage from '@/app/dashboard/super_admin/bookings/page';

function LeadManagerBookingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const upload = searchParams?.get('upload') === '1';

  useEffect(() => {
    if (!upload) {
      router.replace('/dashboard/lead_manager/leads');
    }
  }, [upload, router]);

  if (!upload) return null;

  return (
    <DashboardLayout role="LEAD_MANAGER">
      <SuperAdminBookingsPage />
    </DashboardLayout>
  );
}

export default function LeadManagerBookingsPage() {
  return (
    <Suspense
      fallback={
        <DashboardLayout role="LEAD_MANAGER">
          <div className="py-20 text-center text-slate-500">Loading…</div>
        </DashboardLayout>
      }
    >
      <LeadManagerBookingsContent />
    </Suspense>
  );
}
