'use client';

import DashboardLayout from '@/components/DashboardLayout';
import WorkshopChat from '@/components/chat/WorkshopChat';
import { WorkshopPageHeader, WorkshopPageShell } from '@/components/workshop/WorkshopUi';

export default function WorkshopMechanicChatPage() {
  return (
    <DashboardLayout role="workshop_mechanic">
      <WorkshopPageShell>
        <WorkshopPageHeader
          eyebrow="Workshop Mechanic"
          title="Chat"
          subtitle="Guided steps for jobs and team messages"
        />
        <WorkshopChat />
      </WorkshopPageShell>
    </DashboardLayout>
  );
}
