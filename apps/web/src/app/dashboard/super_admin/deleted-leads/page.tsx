'use client';

import DeletedLeadsPanel from '@/components/crm/DeletedLeadsPanel';

export default function SuperAdminDeletedLeadsPage() {
  return (
    <DeletedLeadsPanel
      padded
      leadHref={(lead) => `/dashboard/super_admin/bookings?lead=${encodeURIComponent(lead.lead_number || lead.id)}`}
    />
  );
}
