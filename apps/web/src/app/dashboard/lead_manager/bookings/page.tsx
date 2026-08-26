'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import SuperAdminBookingsPage from '@/app/dashboard/super_admin/bookings/page';

export default function LeadManagerBookingsPage() {
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
