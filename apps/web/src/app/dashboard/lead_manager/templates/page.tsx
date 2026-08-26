'use client';

import { Suspense } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import PageHelpIcon from '@/components/PageHelpIcon';
import CrmTemplatesPanel from '@/components/telecaller/crm/CrmTemplatesPanel';

function Body() {
  return (
    <div className="w-full min-w-0 max-w-5xl mx-auto">
      <div className="flex justify-end mb-2">
        <PageHelpIcon href="/dashboard/lead_manager/templates" label="Msg Templates" />
      </div>
      <CrmTemplatesPanel basePath="/dashboard/lead_manager/templates" />
    </div>
  );
}

export default function LeadManagerTemplatesPage() {
  return (
    <DashboardLayout role="LEAD_MANAGER">
      <Suspense fallback={<div className="p-8 text-slate-500 text-sm">Loading templates…</div>}>
        <Body />
      </Suspense>
    </DashboardLayout>
  );
}
