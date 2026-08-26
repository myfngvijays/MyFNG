'use client';

import ClickToCallSetupPanel from '@/components/admin/ClickToCallSetupPanel';

export default function SuperAdminClickToCallPage() {
  return (
    <div className="p-4 sm:p-6">
      <ClickToCallSetupPanel canEditSecrets />
    </div>
  );
}
