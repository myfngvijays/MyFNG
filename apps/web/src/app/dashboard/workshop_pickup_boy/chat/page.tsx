'use client';

import DashboardLayout from '@/components/DashboardLayout';
import WorkshopChat from '@/components/chat/WorkshopChat';

export default function WorkshopPickupBoyChatPage() {
  return (
    <DashboardLayout role="workshop_pickup_boy">
      <WorkshopChat />
    </DashboardLayout>
  );
}

