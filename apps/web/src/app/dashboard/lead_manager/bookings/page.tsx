'use client';

import DashboardLayout from '@/components/DashboardLayout';
import SuperAdminBookingsPage from '@/app/dashboard/super_admin/bookings/page';

export default function LeadManagerBookingsPage() {
  return (
    <DashboardLayout role="LEAD_MANAGER">
      <SuperAdminBookingsPage />
    </DashboardLayout>
  );
}
