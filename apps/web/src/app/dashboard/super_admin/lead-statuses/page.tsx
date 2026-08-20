'use client';

import DashboardLayout from '@/components/DashboardLayout';
import LeadStatusesManager from '@/components/telecaller/crm/LeadStatusesManager';

/** Super Admin — create / edit / delete CRM lead statuses */
export default function SuperAdminLeadStatusesPage() {
  return (
    <DashboardLayout role="SUPER_ADMIN">
      <LeadStatusesManager title="Lead Status" />
    </DashboardLayout>
  );
}
