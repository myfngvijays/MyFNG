'use client';

import DashboardLayout from '@/components/DashboardLayout';
import ClickToCallSetupPanel from '@/components/admin/ClickToCallSetupPanel';

export default function LeadManagerClickToCallPage() {
  return (
    <DashboardLayout role="LEAD_MANAGER">
      <div className="p-4 sm:p-6">
        <ClickToCallSetupPanel canEditSecrets={false} />
      </div>
    </DashboardLayout>
  );
}
