'use client';

import DashboardLayout from '@/components/DashboardLayout';
import AdditionalJobsMasterManager from '@/components/additional-jobs/AdditionalJobsMasterManager';
import { AdvisorPageHeader } from '@/components/advisor/AdvisorPageHeader';

export default function WorkshopSupervisorAdditionalJobsMasterPage() {
  return (
    <DashboardLayout role="workshop_supervisor">
      <div className="mx-auto w-full max-w-6xl min-w-0 space-y-3 overflow-x-hidden pb-8 sm:space-y-4">
        <AdvisorPageHeader
          title="Jobs Master"
          subtitle="Reusable additional jobs for faster approvals and billing"
          href="/dashboard/workshop-advisor/additional-jobs-master"
        />
        <AdditionalJobsMasterManager mode="WORKSHOP_SUPERVISOR" hideHeading />
      </div>
    </DashboardLayout>
  );
}

