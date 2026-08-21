'use client';

import PageHelpIcon from '@/components/PageHelpIcon';
import ClickToCallSetupPanel from '@/components/admin/ClickToCallSetupPanel';

export default function SuperAdminClickToCallPage() {
  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Click to Call</h1>
          <p className="text-sm text-slate-500 mt-1">
            Smartflo gateway, DID, and telecaller from-numbers used by Call buttons (web + app).
          </p>
        </div>
        <PageHelpIcon href="/dashboard/super_admin/click-to-call" label="Click to Call" />
      </div>
      <ClickToCallSetupPanel canEditSecrets />
    </div>
  );
}
