'use client';

import DashboardLayout from '@/components/DashboardLayout';
import TransferredLeadsPanel from '@/components/crm/TransferredLeadsPanel';

export default function TelecallerTransferredLeadsPage() {
  return (
    <DashboardLayout role="TELECALLER">
      <TransferredLeadsPanel />
    </DashboardLayout>
  );
}