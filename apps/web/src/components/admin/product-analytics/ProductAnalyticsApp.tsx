'use client';

import { Suspense, useCallback, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { BarChart3, Layers, Settings2, Code2, List, Activity } from 'lucide-react';
import AdminPageRefresh from '@/components/admin/AdminPageRefresh';
import './analytics-admin-theme.css';
import OverviewSection from './sections/OverviewSection';
import PlatformsSection from './sections/PlatformsSection';
import SettingsSection from './sections/SettingsSection';
import CodeReferenceSection from './sections/CodeReferenceSection';
import EventsCatalogSection from './sections/EventsCatalogSection';
import LiveDataSection from './sections/LiveDataSection';

type SectionId = 'overview' | 'platforms' | 'events' | 'live' | 'settings' | 'code';

const NAV = [
  { id: 'overview' as const, label: 'Overview', icon: BarChart3, description: 'Android, iOS & Web status' },
  { id: 'platforms' as const, label: 'Platforms', icon: Layers, description: 'Per-platform tracking details' },
  { id: 'events' as const, label: 'Events', icon: List, description: 'All 78 tracked events catalog' },
  { id: 'live' as const, label: 'Live Data', icon: Activity, description: 'Real-time GA4 event metrics' },
  { id: 'settings' as const, label: 'Settings', icon: Settings2, description: 'Firebase GA4 & Clarity IDs' },
  { id: 'code' as const, label: 'Code Reference', icon: Code2, description: 'Files to change in future' },
];

function sectionFromParam(value: string | null): SectionId {
  if (value === 'platforms' || value === 'settings' || value === 'code' || value === 'events' || value === 'live') return value;
  return 'overview';
}

function ProductAnalyticsAppInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const section = sectionFromParam(searchParams.get('section'));
  const [refreshKey, setRefreshKey] = useState(0);

  const setSection = useCallback(
    (next: SectionId) => {
      router.push(`/dashboard/super_admin/analytics-hub?section=${next}`);
    },
    [router],
  );

  return (
    <div className="analytics-admin-shell min-h-screen">
      <div className="border-b border-violet-100 bg-white/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-violet-600">App + Website</p>
              <h1 className="text-2xl font-black text-gray-900 mt-0.5">Analytics</h1>
              <p className="text-sm text-gray-500 mt-1">
                Firebase Analytics, Microsoft Clarity &amp; GA4 — Android, iOS aur website ek jagah se manage karein.
              </p>
            </div>
            <AdminPageRefresh onClick={() => setRefreshKey((key) => key + 1)} />
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            {NAV.map((item) => {
              const Icon = item.icon;
              const active = section === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSection(item.id)}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition ${
                    active
                      ? 'bg-violet-600 text-white border-violet-600'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-violet-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6" key={refreshKey}>
        {section === 'overview' ? <OverviewSection /> : null}
        {section === 'platforms' ? <PlatformsSection /> : null}
        {section === 'events' ? <EventsCatalogSection /> : null}
        {section === 'live' ? <LiveDataSection /> : null}
        {section === 'settings' ? <SettingsSection /> : null}
        {section === 'code' ? <CodeReferenceSection /> : null}
      </div>
    </div>
  );
}

export default function ProductAnalyticsApp() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-gray-500">Loading analytics…</div>}>
      <ProductAnalyticsAppInner />
    </Suspense>
  );
}
