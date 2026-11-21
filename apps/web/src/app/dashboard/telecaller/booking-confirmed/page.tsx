'use client';

import DashboardLayout from '@/components/DashboardLayout';
import BookingConfirmedPanel from '@/components/crm/BookingConfirmedPanel';

/** Telecaller: only bookings on leads assigned to them (the API scopes it). */
export default function TelecallerBookingConfirmedPage() {
  return (
    <DashboardLayout role="TELECALLER">
      <BookingConfirmedPanel leadHref={(row) => `/dashboard/telecaller/leads?lead=${encodeURIComponent(row.id)}`} />
    </DashboardLayout>
  );
}
