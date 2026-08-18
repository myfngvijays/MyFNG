'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { getCrmDashboardBase } from '@/lib/telecaller/crmRoles';
import { Loader2 } from 'lucide-react';

/** Hub redirects straight to Leaderboard — no duplicate card menu. */
export default function CrmReportsHubPage() {
  const pathname = usePathname();
  const router = useRouter();
  const { base, layoutRole } = getCrmDashboardBase(pathname);

  useEffect(() => {
    router.replace(`${base}/reports/leaderboard`);
  }, [base, router]);

  return (
    <DashboardLayout role={layoutRole}>
      <div className="flex items-center justify-center gap-2 py-24 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" />
        Opening reports…
      </div>
    </DashboardLayout>
  );
}
