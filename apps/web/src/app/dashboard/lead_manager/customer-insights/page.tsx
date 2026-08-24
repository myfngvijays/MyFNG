'use client';

import DashboardLayout from '@/components/DashboardLayout';
import CustomerInsightsApp from '@/components/admin/customer-insights/CustomerInsightsApp';

export default function LeadManagerCustomerInsightsPage() {
  return (
    <DashboardLayout role="LEAD_MANAGER">
      <CustomerInsightsApp />
    </DashboardLayout>
  );
}
