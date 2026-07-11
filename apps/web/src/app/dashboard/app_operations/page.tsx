'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ClipboardList, Gift, Smartphone } from 'lucide-react';
import Link from 'next/link';

export default function AppOperationsHomePage() {
  const router = useRouter();

  useEffect(() => {
    // Default landing — most-used screen
    router.replace('/dashboard/app_operations/bookings');
  }, [router]);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">App Operations</h1>
      <p className="text-gray-600 mb-6">Bookings, app customers, and referral management.</p>
      <div className="grid gap-4 sm:grid-cols-3">
        <Link href="/dashboard/app_operations/bookings" className="rounded-xl border bg-white p-4 hover:border-blue-300">
          <ClipboardList className="w-6 h-6 text-blue-600 mb-2" />
          <div className="font-semibold">Bookings & Leads</div>
        </Link>
        <Link href="/dashboard/app_operations/customer-insights" className="rounded-xl border bg-white p-4 hover:border-blue-300">
          <Smartphone className="w-6 h-6 text-blue-600 mb-2" />
          <div className="font-semibold">App Customers</div>
        </Link>
        <Link href="/dashboard/app_operations/referral" className="rounded-xl border bg-white p-4 hover:border-blue-300">
          <Gift className="w-6 h-6 text-blue-600 mb-2" />
          <div className="font-semibold">Refer & Earn</div>
        </Link>
      </div>
    </div>
  );
}
