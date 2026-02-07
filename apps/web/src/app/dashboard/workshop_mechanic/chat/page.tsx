'use client';

import DashboardLayout from '@/components/DashboardLayout';
import WorkshopChat from '@/components/chat/WorkshopChat';

export default function WorkshopMechanicChatPage() {
  return (
    <DashboardLayout role="workshop_mechanic">
      <WorkshopChat />
    </DashboardLayout>
  );
}

