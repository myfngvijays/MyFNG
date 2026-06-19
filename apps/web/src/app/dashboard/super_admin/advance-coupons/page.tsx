'use client';

import { Suspense } from 'react';
import AdvanceCouponApp from '@/components/admin/advance-coupons/AdvanceCouponApp';

function LoadingShell() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500">
      Loading Advance Coupon Management...
    </div>
  );
}

export default function AdvanceCouponsPage() {
  return (
    <Suspense fallback={<LoadingShell />}>
      <AdvanceCouponApp />
    </Suspense>
  );
}
