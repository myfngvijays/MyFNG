'use client';

import { useEffect, useState } from 'react';
import { BarChart3, IndianRupee } from 'lucide-react';
import { PcmPageHeader, PcmStatCard } from '../shared';

export default function PcmReportsSection() {
  const [redemptions, setRedemptions] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [dashboard, setDashboard] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [rRes, dRes] = await Promise.all([
          fetch('/api/admin/coupons/redemptions?limit=200'),
          fetch('/api/admin/coupons/pcms-dashboard'),
        ]);
        const rJson = await rRes.json();
        const dJson = await dRes.json();
        if (rRes.ok) {
          setRedemptions(rJson.redemptions || []);
          setSummary(rJson.summary || null);
        }
        if (dRes.ok) setDashboard(dJson);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="h-40 pcm-card rounded-xl border animate-pulse" />;

  return (
    <div>
      <PcmPageHeader
        title="Reports & Analytics"
        description="Performance insights across coupons, campaigns, and redemptions"
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <PcmStatCard label="Total Redemptions" value={summary?.count || 0} icon={<BarChart3 className="w-5 h-5" />} accent="primary" />
        <PcmStatCard label="Total Discount" value={`₹${Number(summary?.total_discount || 0).toLocaleString('en-IN')}`} icon={<IndianRupee className="w-5 h-5" />} accent="emerald" />
        <PcmStatCard label="Active Coupons" value={dashboard?.kpis?.active_coupons || 0} icon={<BarChart3 className="w-5 h-5" />} accent="violet" />
        <PcmStatCard label="Assignments" value={dashboard?.kpis?.total_assignments || 0} icon={<BarChart3 className="w-5 h-5" />} accent="amber" />
      </div>

      <div className="pcm-card rounded-xl border overflow-hidden">
        <div className="p-4 border-b border-[#e6e0da] font-bold">Coupon Redemption Log</div>
        <table className="w-full text-sm">
          <thead className="bg-[#f7f3ec]">
            <tr>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-left">Code</th>
              <th className="px-4 py-3 text-left">Customer</th>
              <th className="px-4 py-3 text-left">Phone</th>
              <th className="px-4 py-3 text-left">Lead #</th>
              <th className="px-4 py-3 text-left">Channel</th>
              <th className="px-4 py-3 text-left">Role</th>
              <th className="px-4 py-3 text-left">Discount</th>
            </tr>
          </thead>
          <tbody>
            {redemptions.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-[#72665e]">
                  No redemption records found.
                </td>
              </tr>
            ) : null}
            {redemptions.map((row) => {
              const customer = row.customer_display || {
                name: row.service_lead?.customer_name || row.meta?.customer_name || null,
                phone: row.service_lead?.customer_phone || row.meta?.customer_phone || null,
                lead_number: row.service_lead?.lead_number || row.meta?.lead_number || null,
                channel: row.meta?.channel || row.meta?.type || null,
              };
              return (
              <tr key={row.id} className="border-t border-[#e6e0da]">
                <td className="px-4 py-3">{new Date(row.created_at).toLocaleString('en-IN')}</td>
                <td className="px-4 py-3 font-semibold">{row.coupon?.code || '—'}</td>
                <td className="px-4 py-3">{customer.name || '—'}</td>
                <td className="px-4 py-3">{customer.phone || '—'}</td>
                <td className="px-4 py-3">{customer.lead_number || '—'}</td>
                <td className="px-4 py-3">{customer.channel || '—'}</td>
                <td className="px-4 py-3">{row.applied_by_role}</td>
                <td className="px-4 py-3">₹{Number(row.discount_amount_applied || 0).toLocaleString('en-IN')}</td>
              </tr>
            );})}
          </tbody>
        </table>
      </div>
    </div>
  );
}
