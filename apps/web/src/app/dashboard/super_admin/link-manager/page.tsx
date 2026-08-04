'use client';

import { Suspense } from 'react';
import LinkManagerApp from '@/components/admin/link-manager/LinkManagerApp';

function LoadingShell() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500">
      Loading Link Manager...
    </div>
  );
}

export default function LinkManagerPage() {
  return (
    <Suspense fallback={<LoadingShell />}>
      <LinkManagerApp />
    </Suspense>
  );
}
