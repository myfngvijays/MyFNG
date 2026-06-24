'use client';

import { Suspense } from 'react';
import PostBookingMembershipAdminApp from '@/components/admin/post-booking-membership/PostBookingMembershipAdminApp';

function LoadingShell() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 text-gray-500">
      Loading Post-Booking Prime Offer…
    </div>
  );
}

export default function PostBookingMembershipPage() {
  return (
    <Suspense fallback={<LoadingShell />}>
      <PostBookingMembershipAdminApp />
    </Suspense>
  );
}
