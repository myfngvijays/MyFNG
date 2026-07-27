'use client';

import { Suspense, useCallback, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  LayoutDashboard,
  Ticket,
  Megaphone,
  Zap,
  Users,
  BarChart3,
  Bell,
  Settings,
  Sparkles,
  Layers,
} from 'lucide-react';
import './pcm-theme.css';
import AdminPageRefresh from '@/components/admin/AdminPageRefresh';
import PcmDashboardSection from './sections/DashboardSection';
import PcmCouponsSection from './sections/CouponsSection';
import PcmCampaignsSection from './sections/CampaignsSection';
import PcmAutomationsSection from './sections/AutomationsSection';
import PcmCustomersSection from './sections/CustomersSection';
import PcmReportsSection from './sections/ReportsSection';
import PcmNotificationsSection from './sections/NotificationsSection';

type SectionId =
  | 'dashboard'
  | 'coupons'
  | 'bulk'
  | 'assign'
  | 'campaigns'
  | 'automations'
  | 'customers'
  | 'reports'
  | 'notifications'
  | 'settings';

type NavItem = { id: SectionId; label: string; icon: any; description: string };

const NAV: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, description: 'KPIs & analytics' },
  { id: 'coupons', label: 'Coupons', icon: Ticket, description: 'Create & manage' },
  { id: 'bulk', label: 'Bulk Generate', icon: Layers, description: 'Bulk codes' },
  { id: 'campaigns', label: 'Campaigns', icon: Megaphone, description: 'Campaigns' },
  { id: 'automations', label: 'Automation', icon: Zap, description: 'Rule engine' },
  { id: 'customers', label: 'Customers', icon: Users, description: 'Assignments' },
  { id: 'assign', label: 'Assign', icon: Users, description: 'Bulk assign' },
  { id: 'reports', label: 'Reports', icon: BarChart3, description: 'Analytics' },
  { id: 'notifications', label: 'Activity', icon: Bell, description: 'Audit log' },
  { id: 'settings', label: 'Settings', icon: Settings, description: 'Configuration' },
];

function sectionFromParam(value: string | null): SectionId {
  const allowed = new Set(NAV.map((n) => n.id));
  if (value && allowed.has(value as SectionId)) return value as SectionId;
  return 'dashboard';
}

export default function AdvanceCouponApp() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const section = sectionFromParam(searchParams.get('section'));
  const [headerSearch, setHeaderSearch] = useState(searchParams.get('search') || '');
  const [refreshKey, setRefreshKey] = useState(0);

  const setSection = useCallback(
    (next: string) => {
      const [sectionId, queryString] = next.split('?');
      const params = new URLSearchParams();
      params.set('section', sectionId);
      if (queryString) {
        const extra = new URLSearchParams(queryString);
        extra.forEach((value, key) => params.set(key, value));
      }
      const existingSearch = searchParams.get('search');
      if (existingSearch && sectionId === 'coupons' && !params.has('search')) {
        params.set('search', existingSearch);
      }
      router.push(`/dashboard/super_admin/advance-coupons?${params.toString()}`);
    },
    [router, searchParams],
  );

  const applyHeaderSearch = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('section', 'coupons');
    if (headerSearch.trim()) params.set('search', headerSearch.trim());
    else params.delete('search');
    params.delete('action');
    router.push(`/dashboard/super_admin/advance-coupons?${params.toString()}`);
  }, [headerSearch, router, searchParams]);

  const current = useMemo(() => NAV.find((n) => n.id === section) || NAV[0], [section]);

  const couponTab =
    section === 'bulk' ? 'bulk' : section === 'assign' ? 'assign' : section === 'reports' ? 'redemptions' : 'coupons';

  return (
    <div className="pcm-shell min-h-full">
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-blue-600" />
              Advance Coupon Management
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              {current.label} — {current.description}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AdminPageRefresh onClick={() => setRefreshKey((key) => key + 1)} />
            <input
              className="w-full sm:w-56 px-3 py-2 text-sm rounded-lg border border-gray-300 bg-gray-50 placeholder:text-gray-400"
              placeholder="Search coupons..."
              value={headerSearch}
              onChange={(e) => setHeaderSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') applyHeaderSearch();
              }}
            />
          </div>
        </div>
      </div>

      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 lg:px-8 py-2 overflow-x-auto">
        <div className="flex gap-2 min-w-max pb-1">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold border transition ${
                  active ? 'pcm-tab-active' : 'pcm-tab-inactive'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 py-2">
        <div className="pcm-pro-tip rounded-lg border px-3 py-2 text-xs flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          Use Automation to auto-assign coupons by customer segment, city, and triggers.
        </div>
      </div>

      <main className="px-4 sm:px-6 lg:px-8 pb-8" key={refreshKey}>
        {section === 'dashboard' ? <PcmDashboardSection onNavigate={setSection} /> : null}
        {section === 'coupons' || section === 'bulk' || section === 'assign' ? (
          <Suspense fallback={<div className="h-40 pcm-card rounded-xl border animate-pulse" />}>
            <PcmCouponsSection initialTab={couponTab} />
          </Suspense>
        ) : null}
        {section === 'campaigns' ? <PcmCampaignsSection /> : null}
        {section === 'automations' ? <PcmAutomationsSection /> : null}
        {section === 'customers' ? <PcmCustomersSection /> : null}
        {section === 'reports' ? <PcmReportsSection /> : null}
        {section === 'notifications' ? <PcmNotificationsSection /> : null}
        {section === 'settings' ? (
          <div className="pcm-card rounded-xl border p-8">
            <h2 className="text-xl font-bold mb-2">Coupon Settings</h2>
            <p className="text-sm text-gray-500 mb-6">Quick links for coupon system configuration.</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <button type="button" className="pcm-card border rounded-lg p-4 text-left hover:shadow-md" onClick={() => setSection('coupons')}>
                <div className="font-semibold">Coupon Rules</div>
                <div className="text-xs text-gray-500 mt-1">Channels, cities, usage limits</div>
              </button>
              <button type="button" className="pcm-card border rounded-lg p-4 text-left hover:shadow-md" onClick={() => router.push('/dashboard/super_admin/coupons')}>
                <div className="font-semibold">Classic Coupon Panel</div>
                <div className="text-xs text-gray-500 mt-1">Original admin coupons page</div>
              </button>
              <button type="button" className="pcm-card border rounded-lg p-4 text-left hover:shadow-md" onClick={() => setSection('assign')}>
                <div className="font-semibold">Bulk Assign</div>
                <div className="text-xs text-gray-500 mt-1">CSV, XLS, Google Sheet</div>
              </button>
              <button type="button" className="pcm-card border rounded-lg p-4 text-left hover:shadow-md" onClick={() => setSection('reports')}>
                <div className="font-semibold">Reports</div>
                <div className="text-xs text-gray-500 mt-1">Redemptions & performance</div>
              </button>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
