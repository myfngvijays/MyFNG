'use client';

import DashboardLayout from '@/components/DashboardLayout';
import PageHelpIcon from '@/components/PageHelpIcon';
import LeadStatusesManager from '@/components/telecaller/crm/LeadStatusesManager';

export default function LeadManagerStatusesPage() {
  return (
    <DashboardLayout role="LEAD_MANAGER">
      <LeadStatusesManager
        title="Lead status"
        helpSlot={<PageHelpIcon href="/dashboard/lead_manager/statuses" label="Lead status" />}
      />
    </DashboardLayout>
  );
}
