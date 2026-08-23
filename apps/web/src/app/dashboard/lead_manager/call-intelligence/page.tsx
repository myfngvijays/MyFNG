'use client';

import DashboardLayout from '@/components/DashboardLayout';
import CallIntelligencePanel from '@/components/admin/CallIntelligencePanel';

export default function LeadManagerCallIntelligencePage() {
  return (
    <DashboardLayout role="LEAD_MANAGER">
      <CallIntelligencePanel
        helpHref="/dashboard/lead_manager/call-intelligence"
        recordingsHref="/dashboard/lead_manager/recordings"
      />
    </DashboardLayout>
  );
}
