'use client';

import DashboardLayout from '@/components/DashboardLayout';
import SalesPlaybookPanel from '@/components/admin/SalesPlaybookPanel';

export default function LeadManagerPlaybookPage() {
  return (
    <DashboardLayout role="LEAD_MANAGER">
      <SalesPlaybookPanel
        helpHref="/dashboard/lead_manager/ai-suite/playbook"
        suiteHref="/dashboard/lead_manager/ai-suite"
      />
    </DashboardLayout>
  );
}
