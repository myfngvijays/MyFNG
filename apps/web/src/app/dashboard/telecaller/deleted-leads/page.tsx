'use client';

import DashboardLayout from '@/components/DashboardLayout';
import DeletedLeadsPanel from '@/components/crm/DeletedLeadsPanel';

/** Telecaller: deleted leads that were assigned to them, view-only (the API scopes it). */
export default function TelecallerDeletedLeadsPage() {
  return (
    <DashboardLayout role="TELECALLER">
      <DeletedLeadsPanel
        canRestore={false}
        leadHref={(lead) => `/dashboard/telecaller/leads?lead=${encodeURIComponent(lead.id)}`}
      />
    </DashboardLayout>
  );
}
