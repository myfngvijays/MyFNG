'use client';

import DashboardLayout from '@/components/DashboardLayout';
import AdditionalJobsMasterManager from '@/components/additional-jobs/AdditionalJobsMasterManager';

export default function WorkshopAdminAdditionalJobsMasterPage() {
  return (
    <DashboardLayout role="workshop_admin">
      <AdditionalJobsMasterManager mode="WORKSHOP_ADMIN" />
    </DashboardLayout>
  );
}

