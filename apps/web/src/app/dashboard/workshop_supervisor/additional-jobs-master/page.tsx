'use client';

import DashboardLayout from '@/components/DashboardLayout';
import AdditionalJobsMasterManager from '@/components/additional-jobs/AdditionalJobsMasterManager';

export default function WorkshopSupervisorAdditionalJobsMasterPage() {
  return (
    <DashboardLayout role="workshop_supervisor">
      <AdditionalJobsMasterManager mode="WORKSHOP_SUPERVISOR" />
    </DashboardLayout>
  );
}

