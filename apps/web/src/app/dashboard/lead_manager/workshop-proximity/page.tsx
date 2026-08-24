'use client';

import DashboardLayout from '@/components/DashboardLayout';
import WorkshopProximityApp from '@/components/admin/customer-insights/WorkshopProximityApp';

export default function LeadManagerWorkshopProximityPage() {
  return (
    <DashboardLayout role="LEAD_MANAGER">
      <WorkshopProximityApp />
    </DashboardLayout>
  );
}
