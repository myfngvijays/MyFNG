'use client';

import DashboardLayout from '@/components/DashboardLayout';
import ReferAndRiseApp from '@/components/admin/referral/ReferAndRiseApp';

export default function LeadManagerReferralPage() {
  return (
    <DashboardLayout role="LEAD_MANAGER">
      <ReferAndRiseApp mode="analytics-only" />
    </DashboardLayout>
  );
}
