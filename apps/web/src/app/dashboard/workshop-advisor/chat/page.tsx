'use client';

import DashboardLayout from '@/components/DashboardLayout';
import WorkshopChat from '@/components/chat/WorkshopChat';
import { AdvisorPageHeader } from '@/components/advisor/AdvisorPageHeader';

export default function WorkshopSupervisorChatPage() {
  return (
    <DashboardLayout role="workshop_supervisor">
      <div className="w-full max-w-full min-w-0 space-y-4">
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
