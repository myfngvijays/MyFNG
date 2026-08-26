'use client';

import DashboardLayout from '@/components/DashboardLayout';
import ClickToCallSetupPanel from '@/components/admin/ClickToCallSetupPanel';

export default function LeadManagerClickToCallPage() {
  return (
    <DashboardLayout role="LEAD_MANAGER">
      <div className="w-full min-w-0">
        <ClickToCallSetupPanel canEditSecrets={false} />
      </div>
    </DashboardLayout>
  );
}
