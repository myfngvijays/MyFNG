'use client';

import { useEffect, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Gift,
  Ticket,
  Users,
  Megaphone,
  IndianRupee,
  Building2,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { PcmPageHeader, PcmStatCard } from '../shared';

type DashboardData = {
  kpis: {
    total_coupons: number;
    active_coupons: number;
    expired_coupons: number;
    total_redemptions: number;
    redemption_rate: number;
    total_discount: number;
    active_campaigns: number;
    total_assignments: number;
    total_customers: number;
  };
  top_coupons: Array<{ code: string; count: number }>;
  channel_breakdown: Record<string, number>;
  trend_14d: Array<{ day: string; issued: number; redeemed: number }>;
  recent_redemptions: any[];
};

export default function PcmDashboardSection({
  onNavigate,
}: {
  onNavigate: (section: string) => void;
}) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/coupons/pcms-dashboard');
        const json = await res.json();
        if (res.ok) setData(json);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const k = data?.kpis;

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-28 pcm-card rounded-xl border" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-28 pcm-card rounded-xl border" />
          ))}
        </div>
      </div>
    );
  }

  const channelData = Object.entries(data?.channel_breakdown || {}).map(([name, value]) => ({
    name: name.replace('_', ' '),
    value,
  }));

  return (
    <div>
      <div className="pcm-hero rounded-xl p-6 text-white mb-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-1/3 w-24 h-24 bg-white/5 rounded-full translate-y-1/2" />
        <div className="relative">
          <p className="text-white/90 text-sm">Welcome back, Super Admin 👋</p>
          <h1 className="text-2xl font-bold mt-1">Promotion & Coupon Management System</h1>
          <p className="text-white/90 text-sm mt-2 max-w-2xl">
            You have <strong>{k?.active_coupons || 0} active coupons</strong>,{' '}
            <strong>{k?.total_redemptions || 0} total redemptions</strong>, and{' '}
            <strong>{k?.redemption_rate || 0}% coupons used at least once</strong>.
          </p>
          <div className="flex flex-wrap gap-2 mt-4">
            <button
              type="button"
              className="px-4 py-2 rounded-lg bg-white text-blue-700 hover:bg-white/90 text-sm font-semibold"
              onClick={() => onNavigate('coupons?action=create')}
            >
              + Create Coupon
            </button>
            <button
              type="button"
              className="px-4 py-2 rounded-lg bg-white/15 hover:bg-white/25 text-sm font-semibold"
              onClick={() => onNavigate('campaigns')}
            >
              View Campaigns
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <PcmStatCard label="Total Coupons" value={k?.total_coupons || 0} subtitle={`${k?.active_coupons || 0} active · ${k?.expired_coupons || 0} expired`} icon={<Ticket className="w-5 h-5" />} accent="primary" />
        <PcmStatCard label="Redemptions" value={k?.total_redemptions || 0} subtitle="All-time coupon usage" icon={<Gift className="w-5 h-5" />} accent="emerald" />
        <PcmStatCard label="Discount Given" value={`₹${Number(k?.total_discount || 0).toLocaleString('en-IN')}`} subtitle="Total savings to customers" icon={<IndianRupee className="w-5 h-5" />} accent="violet" />
        <PcmStatCard label="Active Campaigns" value={k?.active_campaigns || 0} subtitle="Unique campaign names" icon={<Megaphone className="w-5 h-5" />} accent="amber" />
        <PcmStatCard label="Total Customers" value={k?.total_customers || 0} subtitle="Registered in MyFNG" icon={<Users className="w-5 h-5" />} accent="sky" />
        <PcmStatCard label="Personal Assignments" value={k?.total_assignments || 0} subtitle="Coupons assigned to users" icon={<Building2 className="w-5 h-5" />} accent="rose" />
        <PcmStatCard label="Coupons Used" value={`${k?.redemption_rate || 0}%`} subtitle="At least one redemption" icon={<Sparkles className="w-5 h-5" />} accent="amber" />
        <PcmStatCard label="Expired" value={k?.expired_coupons || 0} subtitle="Past end date" icon={<Calendar className="w-5 h-5" />} accent="rose" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-4">
        <div className="lg:col-span-2 pcm-card rounded-xl border p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-bold">Coupon Redemption Trend</h3>
              <p className="text-xs text-[#72665e]">Last 14 days</p>
            </div>
            <span className="text-xs font-semibold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">Live</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.trend_14d || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e6e0da" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Area type="monotone" dataKey="redeemed" stroke="#10b981" fill="#10b98133" name="Redeemed" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="pcm-card rounded-xl border p-4">
          <h3 className="font-bold mb-1">Redemption Channels</h3>
          <p className="text-xs text-[#72665e] mb-3">Where coupons are used</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={channelData.length ? channelData : [{ name: 'N/A', value: 0 }]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e6e0da" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="pcm-card rounded-xl border p-4">
          <h3 className="font-bold mb-3">Top Performing Coupons</h3>
          <div className="space-y-2">
            {(data?.top_coupons || []).length === 0 ? (
              <p className="text-sm text-[#72665e]">No redemptions yet.</p>
            ) : (
              data?.top_coupons.map((row, idx) => (
                <div key={row.code} className="flex items-center justify-between py-2 border-b border-[#e6e0da] last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span className="font-semibold">{row.code}</span>
                  </div>
                  <span className="text-sm text-[#72665e]">{row.count} uses</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="pcm-card rounded-xl border p-4">
          <h3 className="font-bold mb-3">Recent Redemptions</h3>
          <div className="space-y-2">
            {(data?.recent_redemptions || []).slice(0, 6).map((row: any) => {
              const customer = row.customer_display || {};
              return (
              <div key={row.id} className="flex items-center justify-between py-2 border-b border-[#e6e0da] last:border-0 text-sm">
                <div>
                  <p className="font-semibold">{row.coupon?.code || '—'}</p>
                  <p className="text-xs text-[#72665e]">
                    {customer.name || 'Customer'}
                    {customer.phone ? ` · ${customer.phone}` : ''}
                  </p>
                  <p className="text-xs text-[#72665e]">{new Date(row.created_at).toLocaleString('en-IN')}</p>
                </div>
                <span className="font-semibold text-emerald-700">₹{Number(row.discount_amount_applied || 0).toLocaleString('en-IN')}</span>
              </div>
            );})}
          </div>
        </div>
      </div>
    </div>
  );
}
