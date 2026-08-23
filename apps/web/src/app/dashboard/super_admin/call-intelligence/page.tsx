'use client';

import CallIntelligencePanel from '@/components/admin/CallIntelligencePanel';

export default function SuperAdminCallIntelligencePage() {
  return (
    <CallIntelligencePanel
      helpHref="/dashboard/super_admin/call-intelligence"
      recordingsHref="/dashboard/super_admin/recordings"
    />
  );
}
