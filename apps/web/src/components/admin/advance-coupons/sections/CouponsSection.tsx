'use client';

import { useSearchParams } from 'next/navigation';
import CouponAdminPanel from '@/components/admin/CouponAdminPanel';

export default function PcmCouponsSection({ initialTab }: { initialTab?: string }) {
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get('search') || '';
  const autoOpenCreate = searchParams.get('action') === 'create';

  return (
    <div className="pcm-embedded-panel">
      <CouponAdminPanel
        initialTab={initialTab as any}
        embedded
        searchQuery={searchQuery}
        autoOpenCreate={autoOpenCreate}
      />
    </div>
  );
}
