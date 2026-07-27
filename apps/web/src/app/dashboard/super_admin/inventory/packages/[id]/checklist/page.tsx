'use client';

import React, { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import PackageChecklistModal from '@/components/admin/PackageChecklistModal';

/** Legacy URL — open checklist as popup on packages list. */
export default function PackageChecklistPage() {
  const params = useParams();
  const router = useRouter();
  const packageId = params?.id ? String(params.id) : '';

  useEffect(() => {
    if (!packageId) {
      router.replace('/dashboard/super_admin/inventory/packages');
    }
  }, [packageId, router]);

  if (!packageId) return null;

  return (
    <div className="min-h-[40vh]">
      <PackageChecklistModal
        packageId={packageId}
        onClose={() => router.replace('/dashboard/super_admin/inventory/packages')}
      />
    </div>
  );
}
