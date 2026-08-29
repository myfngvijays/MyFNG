'use client';

import { Suspense } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import PageHelpIcon from '@/components/PageHelpIcon';
import CrmTemplatesPanel from '@/components/telecaller/crm/CrmTemplatesPanel';

function Body() {
  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl">
      <div className="flex justify-end mb-2">
        <PageHelpIcon href="/dashboard/telecaller/templates" label="Msg Templates" />
      </div>
      <CrmTemplatesPanel basePath="/dashboard/telecaller/templates" />
    </div>
  );
}

export default function TelecallerTemplatesPage() {
  return (
    <DashboardLayout role="TELECALLER">
      <Suspense fallback={<div className="p-8 text-slate-500 text-sm">Loading templates…</div>}>
        <Body />
      </Suspense>
    </DashboardLayout>
  );
}
