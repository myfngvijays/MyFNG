'use client';

import CallIqWorkflowPanel from '@/components/admin/CallIqWorkflowPanel';

export default function SuperAdminCallIqWorkflowPage() {
  return (
    <CallIqWorkflowPanel
      helpHref="/dashboard/super_admin/ai-suite/workflow"
      suiteHref="/dashboard/super_admin/ai-suite"
      callIqHref="/dashboard/super_admin/call-intelligence"
    />
  );
}
