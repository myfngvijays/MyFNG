'use client';

import DashboardLayout from '@/components/DashboardLayout';
import DeletedLeadsPanel from '@/components/crm/DeletedLeadsPanel';

export default function LeadManagerDeletedLeadsPage() {
  return (
    <DashboardLayout role="LEAD_MANAGER">
      <DeletedLeadsPanel leadHref={(lead) => `/dashboard/lead_manager/leads?lead=${encodeURIComponent(lead.id)}`} />
    </DashboardLayout>
  );
}
