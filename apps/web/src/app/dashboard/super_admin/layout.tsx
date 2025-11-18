'use client';

import React, { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import {
  LayoutDashboard,
  Users,
  Store,
  DollarSign,
  Settings,
  BarChart3,
  Shield,
  LogOut,
  Menu,
  X,
  ChevronRight
} from 'lucide-react';

const navigationItems = [
  {
    name: 'Dashboard',
    href: '/dashboard/super_admin',
    icon: LayoutDashboard,
    description: 'Overview & Metrics'
  },
  {
    name: 'Workshops',
    href: '/dashboard/super_admin/workshops',
    icon: Store,
    description: 'Workshop Management'
  },
  {
    name: 'Users',
    href: '/dashboard/super_admin/users',
    icon: Users,
    description: 'User & Role Management'
  },
  {
    name: 'Finance',
    href: '/dashboard/super_admin/finance',
    icon: DollarSign,
    description: 'Payouts & Revenue'
  },
  {
    name: 'System Settings',
    href: '/dashboard/super_admin/settings',
    icon: Settings,
    description: 'System Configuration'
  },
  {
    name: 'Reports',
    href: '/dashboard/super_admin/reports',
    icon: BarChart3,
    description: 'Analytics & Reports'
  }
];

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClientComponentClient();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    if (confirm('Are you sure you want to logout?')) {
      await supabase.auth.signOut();
      router.push('/login');
    }
  };

  const isActive = (href: string) => {
    if (href === '/dashboard/super_admin') {
      return pathname === href;
    }
    return pathname?.startsWith(href);
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Mobile Menu Button */}
      <button
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-lg"
      >
        {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Sidebar - Desktop */}
      <aside
        className={`
          hidden lg:flex flex-col
          ${sidebarOpen ? 'w-72' : 'w-20'}
          bg-gradient-to-b from-red-600 to-red-800 text-white
          transition-all duration-300 ease-in-out
          shadow-2xl
        `}
      >
        {/* Header */}
        <div className="p-6 border-b border-red-500/30">
          <div className="flex items-center justify-between">
            {sidebarOpen ? (
              <div>
                <div className="flex items-center gap-2">
                  <Shield className="w-8 h-8" />
                  <h1 className="text-xl font-bold">MyFNG</h1>
                </div>
                <p className="text-red-200 text-xs mt-1">Super Admin Panel</p>
              </div>
            ) : (
              <Shield className="w-8 h-8 mx-auto" />
            )}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1.5 hover:bg-red-700 rounded-lg transition-colors"
            >
              <ChevronRight
                className={`w-5 h-5 transition-transform ${
                  sidebarOpen ? 'rotate-180' : ''
                }`}
              />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-6 px-3">
          <div className="space-y-2">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);

              return (
                <button
                  key={item.href}
                  onClick={() => router.push(item.href)}
                  className={`
                    w-full flex items-center gap-3 px-4 py-3 rounded-lg
                    transition-all duration-200
                    ${
                      active
                        ? 'bg-white text-red-600 shadow-lg'
                        : 'text-white hover:bg-red-700/50'
                    }
                  `}
                >
                  <Icon className={`w-5 h-5 flex-shrink-0 ${active ? 'text-red-600' : ''}`} />
                  {sidebarOpen && (
                    <div className="flex-1 text-left">
                      <div className={`font-medium ${active ? 'text-red-600' : ''}`}>
                        {item.name}
                      </div>
                      <div
                        className={`text-xs ${
                          active ? 'text-red-500' : 'text-red-200'
                        }`}
                      >
                        {item.description}
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Logout Button */}
        <div className="p-4 border-t border-red-500/30">
          <button
            onClick={handleLogout}
            className={`
              w-full flex items-center gap-3 px-4 py-3 rounded-lg
              bg-red-900/50 hover:bg-red-900 transition-colors
              text-white font-medium
            `}
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Sidebar - Mobile */}
      {mobileMenuOpen && (
        <>
          {/* Overlay */}
          <div
            className="lg:hidden fixed inset-0 bg-black/50 z-40"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Mobile Menu */}
          <aside className="lg:hidden fixed inset-y-0 left-0 w-72 bg-gradient-to-b from-red-600 to-red-800 text-white z-40 shadow-2xl">
            {/* Header */}
            <div className="p-6 border-b border-red-500/30">
              <div className="flex items-center gap-2">
                <Shield className="w-8 h-8" />
                <div>
                  <h1 className="text-xl font-bold">MyFNG</h1>
                  <p className="text-red-200 text-xs">Super Admin Panel</p>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto py-6 px-3">
              <div className="space-y-2">
                {navigationItems.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);

                  return (
                    <button
                      key={item.href}
                      onClick={() => {
                        router.push(item.href);
                        setMobileMenuOpen(false);
                      }}
                      className={`
                        w-full flex items-center gap-3 px-4 py-3 rounded-lg
                        transition-all duration-200
                        ${
                          active
                            ? 'bg-white text-red-600 shadow-lg'
                            : 'text-white hover:bg-red-700/50'
                        }
                      `}
                    >
                      <Icon className={`w-5 h-5 ${active ? 'text-red-600' : ''}`} />
                      <div className="flex-1 text-left">
                        <div className={`font-medium ${active ? 'text-red-600' : ''}`}>
                          {item.name}
                        </div>
                        <div
                          className={`text-xs ${
                            active ? 'text-red-500' : 'text-red-200'
                          }`}
                        >
                          {item.description}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </nav>

            {/* Logout Button */}
            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-red-500/30">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-red-900/50 hover:bg-red-900 transition-colors text-white font-medium"
              >
                <LogOut className="w-5 h-5" />
                <span>Logout</span>
              </button>
            </div>
          </aside>
        </>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}

