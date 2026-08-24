'use client';

import DashboardLayout from '@/components/DashboardLayout';
import LeadIqPanel from '@/components/admin/LeadIqPanel';

export default function LeadManagerLeadIqPage() {
  return (
    <DashboardLayout role="LEAD_MANAGER">
      <LeadIqPanel
        helpHref="/dashboard/lead_manager/lead-iq"
        suiteHref="/dashboard/lead_manager/ai-suite"
        leadsHref="/dashboard/lead_manager/leads"
      />
    </DashboardLayout>
  );
}
