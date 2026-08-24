'use client';

import DashboardLayout from '@/components/DashboardLayout';
import CallIqWorkspace from '@/components/admin/CallIqWorkspace';

export default function LeadManagerCallIntelligencePage() {
  return (
    <DashboardLayout role="LEAD_MANAGER">
      <CallIqWorkspace
        helpHref="/dashboard/lead_manager/call-intelligence"
        recordingsHref="/dashboard/lead_manager/recordings"
        suiteHref="/dashboard/lead_manager/ai-suite"
        playbookHref="/dashboard/lead_manager/ai-suite/playbook"
        workflowHref="/dashboard/lead_manager/ai-suite/workflow"
      />
    </DashboardLayout>
  );
}
