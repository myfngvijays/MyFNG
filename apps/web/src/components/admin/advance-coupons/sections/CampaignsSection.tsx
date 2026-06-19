'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Megaphone, Layers } from 'lucide-react';
import { PcmEmptyState, PcmPageHeader, PcmStatCard, PcmStatusBadge } from '../shared';

export default function PcmCampaignsSection() {
  const router = useRouter();
  const [coupons, setCoupons] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [cRes, oRes] = await Promise.all([
          fetch('/api/admin/coupons'),
          fetch('/api/admin/coupons/options'),
        ]);
        const cJson = await cRes.json();
        const oJson = await oRes.json();
        if (cRes.ok) setCoupons(cJson.coupons || []);
        if (oRes.ok) setBatches(oJson.batches || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const campaigns = useMemo(() => {
    const map = new Map<string, { name: string; coupons: any[]; redemptions: number; active: number }>();
    for (const c of coupons) {
      const name = String(c.campaign_name || 'General').trim() || 'General';
      const row = map.get(name) || { name, coupons: [], redemptions: 0, active: 0 };
      row.coupons.push(c);
      row.redemptions += Number(c.usage_count || 0);
      if (c.is_active) row.active += 1;
      map.set(name, row);
    }
    return [...map.values()].sort((a, b) => b.redemptions - a.redemptions);
  }, [coupons]);

  if (loading) return <div className="h-40 pcm-card rounded-xl border animate-pulse" />;

  return (
    <div>
      <PcmPageHeader
        title="Campaign Management"
        description="Plan, launch, and analyze marketing campaigns across segments"
        actions={
          <button
            type="button"
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white pcm-btn-primary"
            onClick={() => router.push('/dashboard/super_admin/advance-coupons?section=bulk')}
          >
            + New Campaign / Bulk
          </button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <PcmStatCard label="Total Campaigns" value={campaigns.length} icon={<Megaphone className="w-5 h-5" />} accent="primary" />
        <PcmStatCard label="Active Coupons" value={coupons.filter((c) => c.is_active).length} icon={<Layers className="w-5 h-5" />} accent="emerald" />
        <PcmStatCard label="Bulk Batches" value={batches.length} icon={<Layers className="w-5 h-5" />} accent="violet" />
        <PcmStatCard label="Total Redemptions" value={coupons.reduce((s, c) => s + Number(c.usage_count || 0), 0)} icon={<Megaphone className="w-5 h-5" />} accent="amber" />
      </div>

      {campaigns.length === 0 ? (
        <PcmEmptyState
          title="No campaigns yet"
          description="Create coupons with a campaign name or use Bulk Generate to launch a campaign."
        />
      ) : (
        <div className="pcm-card rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#f7f3ec]">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Campaign</th>
                <th className="px-4 py-3 text-left font-semibold">Coupons</th>
                <th className="px-4 py-3 text-left font-semibold">Active</th>
                <th className="px-4 py-3 text-left font-semibold">Redemptions</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((camp) => (
                <tr key={camp.name} className="border-t border-[#e6e0da]">
                  <td className="px-4 py-3 font-semibold">{camp.name}</td>
                  <td className="px-4 py-3">{camp.coupons.length}</td>
                  <td className="px-4 py-3">{camp.active}</td>
                  <td className="px-4 py-3">{camp.redemptions}</td>
                  <td className="px-4 py-3">
                    <PcmStatusBadge status={camp.active > 0 ? 'Active' : 'Inactive'} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {batches.length > 0 ? (
        <div className="mt-6 pcm-card rounded-xl border p-4">
          <h3 className="font-bold mb-3">Bulk Generated Batches</h3>
          <div className="space-y-2">
            {batches.map((b: any) => (
              <div key={b.id} className="flex justify-between text-sm py-2 border-b border-[#e6e0da] last:border-0">
                <span className="font-medium">{b.campaign_name || b.code_prefix}</span>
                <span className="text-[#72665e]">{b.code_count} codes · {b.code_prefix}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
