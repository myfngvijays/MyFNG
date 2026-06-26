'use client';

import { Suspense } from 'react';
import AdvancePushApp from '@/components/admin/advance-notifications/AdvancePushApp';

function LoadingShell() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500">
      Loading Push Notification Management...
    </div>
  );
}

export default function AdvanceNotificationsPage() {
  return (
    <Suspense fallback={<LoadingShell />}>
      <div className="h-screen overflow-hidden">
        <AdvancePushApp />
      </div>
    </Suspense>
  );
}
