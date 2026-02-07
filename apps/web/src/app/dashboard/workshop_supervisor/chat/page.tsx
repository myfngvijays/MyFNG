'use client';

import DashboardLayout from '@/components/DashboardLayout';
import WorkshopChat from '@/components/chat/WorkshopChat';

export default function WorkshopSupervisorChatPage() {
  return (
    <DashboardLayout role="workshop_supervisor">
      <WorkshopChat />
    </DashboardLayout>
  );
}

