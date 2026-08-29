'use client';

import DashboardLayout from '@/components/DashboardLayout';
import AdditionalJobsMasterManager from '@/components/additional-jobs/AdditionalJobsMasterManager';
import { WorkshopPageHeader, WorkshopPageShell } from '@/components/workshop/WorkshopUi';

export default function WorkshopAdminAdditionalJobsMasterPage() {
  return (
    <DashboardLayout role="workshop_admin">
      <WorkshopPageShell>
        <WorkshopPageHeader
          eyebrow="Workshop Owner"
          title="Additional Jobs Master"
          subtitle="Reusable additional jobs for faster approvals and billing"
        />
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <AdditionalJobsMasterManager mode="WORKSHOP_ADMIN" hideHeading />
        </div>
      </WorkshopPageShell>
    </DashboardLayout>
  );
}

