'use client';

import CallIqWorkspace from '@/components/admin/CallIqWorkspace';

export default function SuperAdminCallIntelligencePage() {
  return (
    <CallIqWorkspace
      helpHref="/dashboard/super_admin/call-intelligence"
      recordingsHref="/dashboard/super_admin/recordings"
      suiteHref="/dashboard/super_admin/ai-suite"
      playbookHref="/dashboard/super_admin/ai-suite/playbook"
      workflowHref="/dashboard/super_admin/ai-suite/workflow"
    />
  );
}
