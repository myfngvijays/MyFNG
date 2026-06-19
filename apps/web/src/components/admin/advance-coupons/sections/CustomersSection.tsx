'use client';

import { useEffect, useState } from 'react';
import { UserPlus, Users } from 'lucide-react';
import { PcmPageHeader, PcmStatCard, PcmStatusBadge } from '../shared';

export default function PcmCustomersSection() {
  const [dashboard, setDashboard] = useState<any>(null);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [dRes, aRes] = await Promise.all([
          fetch('/api/admin/coupons/pcms-dashboard'),
          fetch('/api/admin/coupons/assignments?limit=100'),
        ]);
        const dJson = await dRes.json();
        const aJson = await aRes.json();
        if (dRes.ok) setDashboard(dJson);
        if (aRes.ok) setAssignments(aJson.assignments || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="h-40 pcm-card rounded-xl border animate-pulse" />;

  const activeAssignments = assignments.filter((a) => !a.redeemed_at);

  return (
    <div>
      <PcmPageHeader
        title="Customer Assignments"
        description="Real personal coupons assigned to customers — visible in app under My Coupons"
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
        <PcmStatCard label="Total Customers" value={dashboard?.kpis?.total_customers || 0} icon={<Users className="w-5 h-5" />} accent="sky" />
        <PcmStatCard label="Total Assignments" value={dashboard?.kpis?.total_assignments || 0} icon={<UserPlus className="w-5 h-5" />} accent="primary" />
        <PcmStatCard label="Open Assignments" value={activeAssignments.length} icon={<UserPlus className="w-5 h-5" />} accent="emerald" />
      </div>

      <div className="pcm-card rounded-xl border overflow-hidden">
        <div className="p-4 border-b border-[#e6e0da] font-bold">Assigned Coupons</div>
        <table className="w-full text-sm">
          <thead className="bg-[#f7f3ec]">
            <tr>
              <th className="px-4 py-3 text-left">Customer</th>
              <th className="px-4 py-3 text-left">Phone</th>
              <th className="px-4 py-3 text-left">Coupon</th>
              <th className="px-4 py-3 text-left">Assigned</th>
              <th className="px-4 py-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {assignments.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[#72665e]">
                  No assignments yet. Go to Assign Coupons to give personal coupons.
                </td>
              </tr>
            ) : (
              assignments.map((row) => (
                <tr key={row.id} className="border-t border-[#e6e0da]">
                  <td className="px-4 py-3 font-medium">{row.customer?.full_name || '—'}</td>
                  <td className="px-4 py-3">{row.customer?.phone || '—'}</td>
                  <td className="px-4 py-3 font-semibold">{row.coupon?.code || '—'}</td>
                  <td className="px-4 py-3">{new Date(row.created_at).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3">
                    <PcmStatusBadge status={row.redeemed_at ? 'Redeemed' : row.coupon?.is_active ? 'Active' : 'Inactive'} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
