'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  LayoutDashboard,
  Bell,
  Send,
  History,
  Flame,
  Search,
  Sparkles,
} from 'lucide-react';
import './push-admin-theme.css';
import AdminPageRefresh from '@/components/admin/AdminPageRefresh';
import PushDashboardSection from './sections/DashboardSection';
import PushFirebaseSettingsSection from './sections/FirebaseSettingsSection';
import PushComposeSection from './sections/ComposeSection';
import AdvancedComposeSection from './sections/AdvancedComposeSection';
import PushHistorySection from './sections/HistorySection';

type SectionId = 'dashboard' | 'firebase' | 'compose' | 'advanced' | 'history';

type AdminProfile = {
  name: string;
  role: string;
  initials: string;
  greeting: string;
};

type NavItem = { id: SectionId; label: string; icon: typeof Bell; description: string };

const NAV: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, description: 'Devices & broadcast KPIs' },
  { id: 'firebase', label: 'Firebase Settings', icon: Flame, description: 'FCM credentials' },
  { id: 'compose', label: 'Send Notification', icon: Send, description: 'Compose & broadcast' },
  { id: 'advanced', label: 'Advanced Send', icon: Sparkles, description: 'Targeted by city, membership & phone list' },
  { id: 'history', label: 'Notification History', icon: History, description: 'Delivery logs' },
];

function sectionFromParam(value: string | null): SectionId {
  const allowed = new Set<SectionId>(['dashboard', 'firebase', 'compose', 'advanced', 'history']);
  if (value && allowed.has(value as SectionId)) return value as SectionId;
  return 'dashboard';
}

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'SA';
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('');
}

export default function AdvancePushApp() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const section = sectionFromParam(searchParams.get('section'));
  const [headerSearch, setHeaderSearch] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [admin, setAdmin] = useState<AdminProfile>({
    name: 'Super Admin',
    role: 'Super Admin',
    initials: 'SA',
    greeting: 'Hello',
  });

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/super_admin/notifications/dashboard');
        const json = await res.json();
        if (!res.ok) return;
        const name = json.admin?.name || 'Super Admin';
        setAdmin({
          name,
          role: json.admin?.role === 'SUB_ADMIN' ? 'Sub Admin' : 'Super Admin',
          initials: initialsFromName(name),
          greeting: json.admin?.greeting || 'Hello',
        });
      } catch {
        // ignore
      }
    })();
  }, []);

  const setSection = useCallback(
    (next: SectionId) => {
      router.push(`/dashboard/super_admin/advance-notifications?section=${next}`);
    },
    [router],
  );

  const current = useMemo(() => NAV.find((n) => n.id === section) || NAV[0], [section]);

  const renderSection = () => {
    switch (section) {
      case 'dashboard':
        return <PushDashboardSection onNavigate={setSection} admin={admin} />;
      case 'firebase':
        return <PushFirebaseSettingsSection />;
      case 'compose':
        return (
          <Suspense fallback={<div className="h-40 push-card animate-pulse" />}>
            <PushComposeSection />
          </Suspense>
        );
      case 'advanced':
        return (
          <Suspense fallback={<div className="h-40 push-card animate-pulse" />}>
            <AdvancedComposeSection />
          </Suspense>
        );
      case 'history':
        return <PushHistorySection />;
      default:
        return null;
    }
  };

  return (
    <div className="push-admin-shell min-h-full">
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Bell className="w-6 h-6 text-blue-600" />
              Push Notification Management
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              {current.label} — {current.description}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AdminPageRefresh onClick={() => setRefreshKey((key) => key + 1)} />
            <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 w-full sm:w-64">
              <Search className="w-4 h-4 text-gray-400 shrink-0" />
              <input
                type="search"
                placeholder="Search notifications, IDs…"
                value={headerSearch}
                onChange={(e) => setHeaderSearch(e.target.value)}
                className="bg-transparent text-sm outline-none w-full placeholder:text-gray-400"
              />
            </div>
            <span className="push-badge-accent whitespace-nowrap">FCM HTTP v1</span>
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
                  active ? 'push-tab-active' : 'push-tab-inactive'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <main className="px-4 sm:px-6 lg:px-8 py-6" key={refreshKey}>{renderSection()}</main>
    </div>
  );
}
