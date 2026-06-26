'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  LayoutDashboard,
  Bell,
  Send,
  History,
  Flame,
  Users,
  ShoppingCart,
  Ticket,
  Building2,
  BarChart3,
  ChevronRight,
  Search,
  Moon,
  Shield,
} from 'lucide-react';
import './push-admin-theme.css';
import PushDashboardSection from './sections/DashboardSection';
import PushFirebaseSettingsSection from './sections/FirebaseSettingsSection';
import PushComposeSection from './sections/ComposeSection';
import PushHistorySection from './sections/HistorySection';

type SectionId = 'dashboard' | 'firebase' | 'compose' | 'history';

type AdminProfile = {
  name: string;
  role: string;
  initials: string;
  greeting: string;
};

const PUSH_NAV: Array<{ id: SectionId; label: string; icon: typeof Bell }> = [
  { id: 'firebase', label: 'Firebase Settings', icon: Flame },
  { id: 'compose', label: 'Send Notification', icon: Send },
  { id: 'history', label: 'Notification History', icon: History },
];

const OVERVIEW_LINKS = [
  { label: 'Customers', icon: Users, href: '/dashboard/super_admin/customer-insights' },
  { label: 'Orders', icon: ShoppingCart, href: '/dashboard/super_admin/bookings' },
  { label: 'Coupons', icon: Ticket, href: '/dashboard/super_admin/advance-coupons' },
  { label: 'Service Centers', icon: Building2, href: '/dashboard/super_admin/workshops' },
  { label: 'Reports', icon: BarChart3, href: '/dashboard/super_admin/reports' },
];

const SECTION_META: Record<SectionId, { group: string; title: string }> = {
  dashboard: { group: 'Overview', title: 'Dashboard' },
  firebase: { group: 'Push Notifications', title: 'Firebase Settings' },
  compose: { group: 'Push Notifications', title: 'Send Notification' },
  history: { group: 'Push Notifications', title: 'Notification History' },
};

function sectionFromParam(value: string | null): SectionId {
  const allowed = new Set<SectionId>(['dashboard', 'firebase', 'compose', 'history']);
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

  const meta = useMemo(() => SECTION_META[section], [section]);

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
      case 'history':
        return <PushHistorySection />;
      default:
        return null;
    }
  };

  return (
    <div className="push-admin-shell flex h-screen overflow-hidden">
      <aside className="push-sidebar-dark hidden md:flex w-[260px] shrink-0 border-r flex-col">
        <div className="px-5 py-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#1f7a55] text-white flex items-center justify-center font-bold text-lg">
              M
            </div>
            <div>
              <div className="font-bold text-white leading-tight">MyFNG</div>
              <div className="text-xs text-white/50">Admin Console</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
          <div>
            <div className="push-nav-section-dark">Overview</div>
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => setSection('dashboard')}
                className={`push-nav-item-dark ${section === 'dashboard' ? 'active' : ''}`}
              >
                <LayoutDashboard className="w-4 h-4 shrink-0" />
                Dashboard
              </button>
              {OVERVIEW_LINKS.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => router.push(item.href)}
                    className="push-nav-item-dark"
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="push-nav-section-dark">Push Notifications</div>
            <div className="space-y-1">
              {PUSH_NAV.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSection(item.id)}
                    className={`push-nav-item-dark ${section === item.id ? 'active' : ''}`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        </nav>

        <div className="p-4 border-t border-white/10 space-y-3">
          <div className="push-footer-dark">
            <strong className="inline-flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" />
              Super Admin Mode
            </strong>
            <span>You have full control over Firebase credentials &amp; notifications.</span>
          </div>
          <div className="text-[11px] font-semibold text-white/40 px-1">v1.0 · FCM HTTP v1</div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-gray-200 px-4 md:px-8 py-3 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-0.5">
              <span>{meta.group}</span>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-gray-900 font-medium">{meta.title}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden lg:flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 w-64">
              <Search className="w-4 h-4 text-gray-400" />
              <input
                type="search"
                placeholder="Search notifications, IDs…"
                className="bg-transparent text-sm outline-none w-full placeholder:text-gray-400"
              />
            </div>
            <button type="button" className="p-2 rounded-lg hover:bg-gray-100 text-gray-600" aria-label="Dark mode">
              <Moon className="w-5 h-5" />
            </button>
            <button type="button" className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 relative" aria-label="Alerts">
              <Bell className="w-5 h-5" />
            </button>
            <div className="hidden sm:block text-right">
              <div className="text-sm font-semibold text-gray-900">{admin.name}</div>
              <div className="text-xs text-gray-500">{admin.role}</div>
            </div>
            <div className="h-10 w-10 rounded-full bg-[#1f7a55] text-white flex items-center justify-center text-sm font-bold">
              {admin.initials}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto px-4 md:px-8 py-6">
          <div className="md:hidden mb-4">
            <select
              className="w-full rounded-lg border px-3 py-2.5 text-sm bg-white"
              value={section}
              onChange={(e) => setSection(e.target.value as SectionId)}
            >
              <option value="dashboard">Dashboard</option>
              <option value="firebase">Firebase Settings</option>
              <option value="compose">Send Notification</option>
              <option value="history">Notification History</option>
            </select>
          </div>
          {renderSection()}
        </main>
      </div>
    </div>
  );
}
