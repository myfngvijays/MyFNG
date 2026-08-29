'use client';

import DashboardLayout from '@/components/DashboardLayout';
import WorkshopChat from '@/components/chat/WorkshopChat';
import { WorkshopPageHeader, WorkshopPageShell } from '@/components/workshop/WorkshopUi';

export default function WorkshopAdminChatPage() {
  return (
    <DashboardLayout role="workshop_admin">
      <WorkshopPageShell>
        <WorkshopPageHeader
          eyebrow="Workshop Owner"
          title="Chat"
          subtitle="Guided steps for leads, jobs, and team messages"
        />
        <WorkshopChat />
      </WorkshopPageShell>
    </DashboardLayout>
  );
}
