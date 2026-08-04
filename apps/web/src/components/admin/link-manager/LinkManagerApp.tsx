'use client';

import { Suspense, useCallback, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LayoutDashboard, Link2, BarChart3 } from 'lucide-react';
import AdminPageRefresh from '@/components/admin/AdminPageRefresh';
import CreateLinkSection from './sections/CreateLinkSection';
import LinksListSection from './sections/LinksListSection';
import AnalyticsSection from './sections/AnalyticsSection';
import DashboardSection from './sections/DashboardSection';

type SectionId = 'dashboard' | 'create' | 'links' | 'analytics';

type NavItem = { id: SectionId; label: string; icon: any; description: string };

const NAV: NavItem[] = [
  { id: 'dashboard', label: 'Overview', icon: LayoutDashboard, description: 'Stats & top links' },
  { id: 'create', label: 'Create Link', icon: Link2, description: 'Short link + QR' },
  { id: 'links', label: 'My Links', icon: Link2, description: 'Manage all links' },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, description: 'Clicks & tracking' },
];

function sectionFromParam(value: string | null): SectionId {
  const allowed = new Set(NAV.map((n) => n.id));
  if (value && allowed.has(value as SectionId)) return value as SectionId;
  return 'create';
}

export default function LinkManagerApp() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-gray-500">Loading link manager…</div>}>
      <LinkManagerAppInner />
    </Suspense>
  );
}

function LinkManagerAppInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const section = sectionFromParam(searchParams.get('section'));
  const [refreshKey, setRefreshKey] = useState(0);

  const setSection = useCallback(
    (next: SectionId) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('section', next);
      router.push(`/dashboard/super_admin/link-manager?${params.toString()}`);
    },
    [router, searchParams],
  );

  const current = useMemo(() => NAV.find((n) => n.id === section) || NAV[1], [section]);

  return (
    <div className="min-h-full bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Link2 className="w-6 h-6 text-blue-600" />
              Link Manager
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              {current.label} — {current.description}
            </p>
          </div>
          <AdminPageRefresh onClick={() => setRefreshKey((key) => key + 1)} />
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
                  active
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <main className="px-4 sm:px-6 lg:px-8 py-6 pb-10" key={refreshKey}>
        {section === 'dashboard' ? <DashboardSection onNavigate={setSection} /> : null}
        {section === 'create' ? <CreateLinkSection onCreated={() => setSection('links')} /> : null}
        {section === 'links' ? <LinksListSection /> : null}
        {section === 'analytics' ? <AnalyticsSection /> : null}
      </main>
    </div>
  );
}
