'use client';

import { usePathname } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import PageHelpIcon from '@/components/PageHelpIcon';
import CrmDialerPanel from '@/components/telecaller/crm/CrmDialerPanel';
import { getCrmDashboardBase } from '@/lib/telecaller/crmRoles';

export default function TelecallerDialerPage() {
  const pathname = usePathname();
  const { base, layoutRole } = getCrmDashboardBase(pathname);

  return (
    <DashboardLayout role={layoutRole}>
      <div className="mx-auto w-full min-w-0 max-w-3xl">
        <div className="mb-4 flex items-center gap-2">
          <PageHelpIcon href={`${base}/dialer`} label="Dialer" />
        </div>
        <CrmDialerPanel />
      </div>
    </DashboardLayout>
  );
}
