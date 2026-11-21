'use client';

import BookingConfirmedPanel from '@/components/crm/BookingConfirmedPanel';

export default function SuperAdminBookingConfirmedPage() {
  return (
    <BookingConfirmedPanel
      leadHref={(row) => `/dashboard/super_admin/bookings?lead=${encodeURIComponent(row.lead_number || row.id)}`}
    />
  );
}
