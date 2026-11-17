'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Sub Admin uses the main admin panel. Users and System Settings stay with System Administrator. */
export default function SubAdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard/super_admin');
  }, [router]);
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-sm text-gray-500">Opening admin panel…</p>
      <span className="sr-only">{children ? 'redirect' : ''}</span>
    </div>
  );
}
