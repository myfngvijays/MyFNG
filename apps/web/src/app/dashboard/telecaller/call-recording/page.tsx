'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Folder } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { getCrmDashboardBase } from '@/lib/telecaller/crmRoles';

export default function CallRecordingPage() {
  const pathname = usePathname();
  const { layoutRole } = getCrmDashboardBase(pathname);
  const [folder, setFolder] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/telecaller/profile/recording-path');
        const data = await res.json();
        const label = String(data?.path?.label || '');
        if (!cancelled) setFolder(res.ok && label && !label.startsWith('content://') ? label : '');
      } catch {
        if (!cancelled) setFolder('');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <DashboardLayout role={layoutRole}>
      <div className="mx-auto w-full max-w-lg">
        <h1 className="text-2xl font-extrabold" style={{ color: '#0F172A' }}>
          Call Recording
        </h1>
        <section className="mt-4 rounded-2xl border border-slate-100 bg-white shadow-sm">
          <p className="px-4 pt-4 text-lg font-extrabold" style={{ color: '#0F172A' }}>
            Recording&apos;s Folder
          </p>
          <div className="flex flex-col items-center px-4 py-6">
            <Folder className="h-14 w-14 text-slate-300" />
            <p className="mt-2 text-sm font-semibold text-slate-500">{folder || 'No folder selected'}</p>
          </div>
          <p className="border-t border-slate-100 px-4 py-3 text-sm font-semibold text-violet-600">
            Suggested folder: Internal storage / Recordings / Call
          </p>
        </section>
        <p className="mt-3 text-center text-sm text-slate-500">
          Select folder and Sync are on the phone app, in Call Recording.
        </p>
      </div>
    </DashboardLayout>
  );
}
