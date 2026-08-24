'use client';

import LeadIqPanel from '@/components/admin/LeadIqPanel';

export default function SuperAdminLeadIqPage() {
  return (
    <LeadIqPanel
      helpHref="/dashboard/super_admin/lead-iq"
      suiteHref="/dashboard/super_admin/ai-suite"
      leadsHref="/dashboard/super_admin/bookings"
    />
  );
}
