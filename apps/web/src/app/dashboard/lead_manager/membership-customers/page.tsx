'use client';

import DashboardLayout from '@/components/DashboardLayout';
import MembershipCustomersApp from '@/components/admin/membership-customers/MembershipCustomersApp';

export default function LeadManagerMembershipCustomersPage() {
  return (
    <DashboardLayout role="LEAD_MANAGER">
      <MembershipCustomersApp />
    </DashboardLayout>
  );
}
