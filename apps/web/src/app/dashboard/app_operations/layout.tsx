'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getBrowserClient } from '@/lib/supabase/browserClient';
import {
  ClipboardList,
  Gift,
  LayoutDashboard,
  LogOut,
  Menu,
  Smartphone,
  Crown,
  X,
} from 'lucide-react';

const APP_OPS_ROLE = 'APP_OPERATIONS';

type NavItem = {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
};

const navigationItems: NavItem[] = [
  {
    name: 'Dashboard',
    href: '/dashboard/app_operations',
    icon: LayoutDashboard,
    description: 'Overview',
  },
  {
    name: 'Bookings & Leads',
    href: '/dashboard/app_operations/bookings',
    icon: ClipboardList,
    description: 'Service leads & AI bookings',
  },
  {
    name: 'App Customers',
    href: '/dashboard/app_operations/customer-insights',
    icon: Smartphone,
    description: 'App users, bookings & wallet',
  },
  {
    name: 'Membership Customers',
    href: '/dashboard/app_operations/membership-customers',
    icon: Crown,
    description: 'Prime members & benefits',
  },
  {
    name: 'Refer & Earn',
    href: '/dashboard/app_operations/referral',
    icon: Gift,
    description: 'Referral rewards & activity',
  },
];

export default function AppOperationsLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = useMemo(() => getBrowserClient(), []);
  const [ready, setReady] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userName, setUserName] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/login');
        return;
      }
      const { data: profile } = await supabase
        .from('users_login')
        .select('full_name, is_active, roles!inner(role_code)')
        .eq('id', user.id)
        .maybeSingle();
      const roleCode = (profile?.roles as any)?.role_code;
      if (!profile?.is_active || roleCode !== APP_OPS_ROLE) {
        router.replace('/login');
        return;
      }
      if (active) {
        setUserName(String(profile.full_name || 'App Operations'));
        setReady(true);
      }
    })();
    return () => { active = false; };
  }, [router, supabase]);

  const handleLogout = async () => {
    if (!confirm('Are you sure you want to logout?')) return;
    await supabase.auth.signOut();
    router.push('/login');
  };

  const isActive = (href: string) => {
    if (href === '/dashboard/app_operations') return pathname === href;
    return pathname?.startsWith(href);
  };

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-sm text-gray-500">Loading…</div>
      </div>
    );
  }

  const nav = (
    <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
      {navigationItems.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.href);
        return (
          <button
            key={item.href}
            type="button"
            onClick={() => {
              router.push(item.href);
              setMobileOpen(false);
            }}
            className={`w-full flex items-start gap-3 px-3 py-3 rounded-xl text-left transition-colors ${
              active ? 'bg-white/15 text-white shadow-sm' : 'text-blue-100 hover:bg-white/10'
            }`}
          >
            <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${active ? 'text-yellow-300' : ''}`} />
            <span>
              <span className="block text-sm font-semibold">{item.name}</span>
              <span className="block text-xs opacity-80 mt-0.5">{item.description}</span>
            </span>
          </button>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen bg-gray-50">
      <button
        type="button"
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow"
      >
        {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      <aside className="hidden lg:flex w-72 flex-col bg-gradient-to-b from-blue-600 via-blue-700 to-blue-900 text-white shadow-xl">
        <div className="p-6 border-b border-blue-400/30">
          <p className="text-xs uppercase tracking-wider text-blue-200">MyFNG Admin</p>
          <h1 className="text-xl font-bold mt-1">App Operations</h1>
          <p className="text-sm text-blue-100 mt-2">{userName}</p>
        </div>
        {nav}
        <div className="p-4 border-t border-blue-400/30">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-sm font-semibold"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </aside>

      {mobileOpen ? (
        <div className="lg:hidden fixed inset-0 z-40">
          <button type="button" className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-72 h-full flex flex-col bg-gradient-to-b from-blue-600 to-blue-900 text-white shadow-xl">
            <div className="p-6 border-b border-blue-400/30">
              <h1 className="text-lg font-bold">App Operations</h1>
            </div>
            {nav}
            <div className="p-4 border-t border-blue-400/30">
              <button type="button" onClick={handleLogout} className="w-full py-2.5 rounded-lg bg-white/10 text-sm font-semibold">
                Logout
              </button>
            </div>
          </aside>
        </div>
      ) : null}

      <main className="flex-1 min-w-0 overflow-auto">
        <div className="lg:hidden h-14" />
        {children}
      </main>
    </div>
  );
}
