'use client';

import DashboardLayout from '@/components/DashboardLayout';
import PageHelpIcon from '@/components/PageHelpIcon';
import LeadFieldsManager from '@/components/telecaller/crm/LeadFieldsManager';

export default function LeadManagerFieldsPage() {
  return (
    <DashboardLayout role="LEAD_MANAGER">
      <LeadFieldsManager
        title="Lead fields"
        helpSlot={<PageHelpIcon href="/dashboard/lead_manager/fields" label="Lead fields" />}
      />
    </DashboardLayout>
  );
}
