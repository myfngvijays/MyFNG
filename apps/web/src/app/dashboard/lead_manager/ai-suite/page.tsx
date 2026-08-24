'use client';

import DashboardLayout from '@/components/DashboardLayout';
import AiSuiteHub from '@/components/admin/AiSuiteHub';

export default function LeadManagerAiSuitePage() {
  return (
    <DashboardLayout role="LEAD_MANAGER">
      <AiSuiteHub base="/dashboard/lead_manager" helpHref="/dashboard/lead_manager/ai-suite" />
    </DashboardLayout>
  );
}
