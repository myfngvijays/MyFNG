'use client';

import { Suspense, useCallback, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LayoutDashboard, Link2, BookOpen, MousePointerClick, Tags } from 'lucide-react';
import AdminPageRefresh from '@/components/admin/AdminPageRefresh';
import CreateLinkSection from './sections/CreateLinkSection';
import LinksListSection from './sections/LinksListSection';
import DashboardSection from './sections/DashboardSection';
import ReadmeSection from './sections/ReadmeSection';
import RecentOpensSection from './sections/RecentOpensSection';
import UtmLinksSection from './sections/UtmLinksSection';

type LinkManagerSectionId =
  | 'dashboard'
  | 'create'
  | 'links'
  | 'recent-opens'
  | 'utm-links'
  | 'readme';

type NavItem = { id: LinkManagerSectionId; label: string; icon: any; description: string };

const NAV: NavItem[] = [
  { id: 'dashboard', label: 'Overview', icon: LayoutDashboard, description: 'KPIs, top links & quick lists' },
  { id: 'create', label: 'Create Link', icon: Link2, description: 'Advanced short link, QR, targeting' },
  { id: 'links', label: 'My Links', icon: Link2, description: 'Search, paginate & manage links' },
  { id: 'recent-opens', label: 'Recent Opens', icon: MousePointerClick, description: 'All clicks & QR scans with filters' },
  { id: 'utm-links', label: 'UTM Links', icon: Tags, description: 'Links with UTM tags — full list' },
  { id: 'readme', label: 'README', icon: BookOpen, description: 'What each option does & how it works' },
];

function sectionFromParam(value: string | null): LinkManagerSectionId {
  if (value === 'analytics') return 'dashboard';
  const allowed = new Set(NAV.map((n) => n.id));
  if (value && allowed.has(value as LinkManagerSectionId)) return value as LinkManagerSectionId;
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
    (next: LinkManagerSectionId) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('section', next);
      router.push(`/dashboard/super_admin/link-manager?${params.toString()}`);
    },
    [router, searchParams],
  );

  const current = useMemo(() => NAV.find((n) => n.id === section) || NAV[1], [section]);

  return (
    <div className="min-h-full bg-gray-50">
      <div className="border-b border-gray-200 bg-white px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900 sm:text-2xl">
              <Link2 className="h-6 w-6 text-blue-600" />
              Link Manager
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              {current.label} — {current.description}
            </p>
          </div>
          <AdminPageRefresh onClick={() => setRefreshKey((key) => key + 1)} />
        </div>
      </div>

      <div className="overflow-x-auto border-b border-gray-200 bg-white px-4 py-2 sm:px-6 lg:px-8">
        <div className="flex min-w-max gap-2 pb-1">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition sm:text-sm ${
                  active
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <main className="px-4 py-6 pb-10 sm:px-6 lg:px-8" key={refreshKey}>
        {section === 'dashboard' ? <DashboardSection onNavigate={setSection} /> : null}
        {section === 'create' ? <CreateLinkSection onCreated={() => setSection('links')} /> : null}
        {section === 'links' ? <LinksListSection /> : null}
        {section === 'recent-opens' ? <RecentOpensSection /> : null}
        {section === 'utm-links' ? <UtmLinksSection /> : null}
        {section === 'readme' ? <ReadmeSection /> : null}
      </main>
    </div>
  );
}
