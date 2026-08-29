'use client';

import DashboardLayout from '@/components/DashboardLayout';
import WorkshopChat from '@/components/chat/WorkshopChat';
import { AdvisorPageHeader } from '@/components/advisor/AdvisorPageHeader';

export default function WorkshopSupervisorChatPage() {
  return (
    <DashboardLayout role="workshop_supervisor">
      <div className="mx-auto w-full max-w-6xl min-w-0 space-y-3 overflow-x-hidden pb-8 sm:space-y-4">
        <AdvisorPageHeader
          title="Chat"
          subtitle="Guided steps for leads, jobs, and team messages"
          href="/dashboard/workshop-advisor/chat"
        />
        <WorkshopChat />
      </div>
    </DashboardLayout>
  );
}
