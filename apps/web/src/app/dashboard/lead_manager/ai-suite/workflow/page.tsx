'use client';

import DashboardLayout from '@/components/DashboardLayout';
import CallIqWorkflowPanel from '@/components/admin/CallIqWorkflowPanel';

export default function LeadManagerCallIqWorkflowPage() {
  return (
    <DashboardLayout role="LEAD_MANAGER">
      <CallIqWorkflowPanel
        helpHref="/dashboard/lead_manager/ai-suite/workflow"
        suiteHref="/dashboard/lead_manager/ai-suite"
        callIqHref="/dashboard/lead_manager/call-intelligence"
      />
    </DashboardLayout>
  );
}
