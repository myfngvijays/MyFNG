'use client';

import LeadStatusesManager from '@/components/telecaller/crm/LeadStatusesManager';

/** Super Admin — create / edit / delete CRM lead statuses */
export default function SuperAdminLeadStatusesPage() {
  return (
    <div className="px-4 py-6 sm:px-6">
      <LeadStatusesManager title="Lead Status" />
    </div>
  );
}
