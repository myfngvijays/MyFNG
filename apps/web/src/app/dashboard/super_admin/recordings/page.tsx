'use client';

import AdminRecordingsPanel from '@/components/admin/AdminRecordingsPanel';

export default function SuperAdminRecordingsPage() {
  return (
    <AdminRecordingsPanel
      helpHref="/dashboard/super_admin/recordings"
      bookingsHref="/dashboard/super_admin/bookings"
    />
  );
}
