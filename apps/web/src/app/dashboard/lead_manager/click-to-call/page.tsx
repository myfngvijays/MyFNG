'use client';

import DashboardLayout from '@/components/DashboardLayout';
import PageHelpIcon from '@/components/PageHelpIcon';
import ClickToCallSetupPanel from '@/components/admin/ClickToCallSetupPanel';

export default function LeadManagerClickToCallPage() {
  return (
    <DashboardLayout role="LEAD_MANAGER">
      <div className="p-4 sm:p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Click to Call</h1>
            <p className="text-sm text-slate-500 mt-1">
              Set telecaller from-numbers and test Smartflo calls. Gateway secrets are managed by Super Admin.
            </p>
          </div>
          <PageHelpIcon href="/dashboard/lead_manager/click-to-call" label="Click to Call" />
        </div>
        <ClickToCallSetupPanel canEditSecrets={false} />
      </div>
    </DashboardLayout>
  );
}
