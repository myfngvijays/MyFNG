'use client';

import DashboardLayout from '@/components/DashboardLayout';
import WorkshopChat from '@/components/chat/WorkshopChat';
import { WorkshopPageHeader, WorkshopPageShell } from '@/components/workshop/WorkshopUi';

export default function WorkshopPickupBoyChatPage() {
  return (
    <DashboardLayout role="workshop_pickup_boy">
      <WorkshopPageShell>
        <WorkshopPageHeader
          eyebrow="Pickupboy / Driver"
          title="Chat"
          subtitle="Guided steps for pickup and delivery messages"
        />
        <WorkshopChat />
      </WorkshopPageShell>
    </DashboardLayout>
  );
}
