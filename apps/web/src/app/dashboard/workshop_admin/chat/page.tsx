'use client';

import DashboardLayout from '@/components/DashboardLayout';
import WorkshopChat from '@/components/chat/WorkshopChat';

export default function WorkshopAdminChatPage() {
  return (
    <DashboardLayout role="workshop_admin">
      <WorkshopChat />
    </DashboardLayout>
  );
}

