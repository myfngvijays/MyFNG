'use client';

import DashboardLayout from '@/components/DashboardLayout';
import AdminRecordingsPanel from '@/components/admin/AdminRecordingsPanel';

export default function LeadManagerRecordingsPage() {
  return (
    <DashboardLayout role="LEAD_MANAGER">
      <AdminRecordingsPanel
        helpHref="/dashboard/lead_manager/recordings"
        bookingsHref="/dashboard/lead_manager/leads"
      />
    </DashboardLayout>
  );
}
