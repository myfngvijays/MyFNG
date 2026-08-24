'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

const PATH_MAP: Record<string, string> = {
  '/dashboard/app_operations': '/dashboard/lead_manager',
  '/dashboard/app_operations/bookings': '/dashboard/lead_manager/bookings',
  '/dashboard/app_operations/customer-insights': '/dashboard/lead_manager/customer-insights',
  '/dashboard/app_operations/workshop-proximity': '/dashboard/lead_manager/workshop-proximity',
  '/dashboard/app_operations/membership-customers': '/dashboard/lead_manager/membership-customers',
  '/dashboard/app_operations/referral': '/dashboard/lead_manager/referral',
};

export default function RetiredAppOperationsLayout() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const dest =
      PATH_MAP[pathname || ''] ||
      (pathname || '').replace('/dashboard/app_operations', '/dashboard/lead_manager') ||
      '/dashboard/lead_manager';
    router.replace(dest);
  }, [pathname, router]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-gray-500">
      Redirecting to Lead Manager…
    </div>
  );
}
