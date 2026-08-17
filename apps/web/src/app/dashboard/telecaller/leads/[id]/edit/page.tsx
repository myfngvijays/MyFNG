'use client';

import { useEffect } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { getCrmDashboardBase } from '@/lib/telecaller/crmRoles';
import { Loader2 } from 'lucide-react';

/** Legacy `/edit` — open lead screen (inline edit), no separate Edit Lead page. */
export default function EditLeadPage() {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const leadId = params?.id as string;
  const { base, layoutRole } = getCrmDashboardBase(pathname);

  useEffect(() => {
    if (leadId) router.replace(`${base}/leads/${leadId}`);
  }, [base, leadId, router]);

  return (
    <DashboardLayout role={layoutRole}>
      <div className="flex items-center justify-center gap-2 py-24 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" /> Opening lead…
      </div>
    </DashboardLayout>
  );
}
