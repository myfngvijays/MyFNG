'use client';

import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { PcmPageHeader, PcmStatusBadge } from '../shared';

export default function PcmNotificationsSection() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/coupons/audit-log?limit=50');
        const json = await res.json();
        if (res.ok) setLogs(json.logs || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="h-40 pcm-card rounded-xl border animate-pulse" />;

  return (
    <div>
      <PcmPageHeader
        title="Coupon Activity Log"
        description="Real audit trail — creates, assigns, bulk operations"
      />

      <div className="pcm-card rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#f7f3ec]">
            <tr>
              <th className="px-4 py-3 text-left">When</th>
              <th className="px-4 py-3 text-left">Action</th>
              <th className="px-4 py-3 text-left">Details</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-[#72665e]">No activity logged yet.</td>
              </tr>
            ) : (
              logs.map((row) => (
                <tr key={row.id} className="border-t border-[#e6e0da]">
                  <td className="px-4 py-3">{new Date(row.created_at).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3"><PcmStatusBadge status={row.action} /></td>
                  <td className="px-4 py-3 text-xs text-[#72665e]">{JSON.stringify(row.details || {})}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 pcm-card rounded-xl border p-4 flex items-center gap-3">
        <Bell className="w-5 h-5 text-blue-600" />
        <p className="text-sm text-[#72665e]">
          For push broadcasts to customers, use Super Admin → Send Notification.
        </p>
      </div>
    </div>
  );
}
