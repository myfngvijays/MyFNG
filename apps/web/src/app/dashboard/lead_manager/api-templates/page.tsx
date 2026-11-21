'use client';

import DashboardLayout from '@/components/DashboardLayout';
import ApiTemplatesPanel from '@/components/crm/ApiTemplatesPanel';

export default function LeadManagerApiTemplatesPage() {
  return (
    <DashboardLayout role="LEAD_MANAGER">
      <ApiTemplatesPanel />
    </DashboardLayout>
  );
}
