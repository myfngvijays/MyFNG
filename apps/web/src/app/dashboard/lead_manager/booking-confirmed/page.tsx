'use client';

import DashboardLayout from '@/components/DashboardLayout';
import BookingConfirmedPanel from '@/components/crm/BookingConfirmedPanel';

export default function LeadManagerBookingConfirmedPage() {
  return (
    <DashboardLayout role="LEAD_MANAGER">
      <BookingConfirmedPanel leadHref={(row) => `/dashboard/lead_manager/leads?lead=${encodeURIComponent(row.id)}`} />
    </DashboardLayout>
  );
}
