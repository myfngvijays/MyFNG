'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bot, Home, LifeBuoy, Phone, Wrench } from 'lucide-react';
import type { ComponentType } from 'react';

type NavItem = {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  matchPrefixes: string[];
};

const navItems: NavItem[] = [
  { label: 'Home', href: '/', icon: Home, matchPrefixes: ['/'] },
  { label: 'Services', href: '/services', icon: Wrench, matchPrefixes: ['/services', '/car-services'] },
  {
    label: 'Roadside',
    href: '/car-roadside-assitance',
    icon: LifeBuoy,
    matchPrefixes: ['/car-roadside-assitance', '/roadside-assistance', '/rsa_landing'],
  },
  { label: 'Contact', href: '/contact', icon: Phone, matchPrefixes: ['/contact', '/customer/login', '/login'] },
];

function isItemActive(pathname: string, item: NavItem): boolean {
  if (item.href === '/') {
    return pathname === '/';
  }

  return item.matchPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export default function MobileBottomNav() {
  const pathname = usePathname();
  const [isEmbed, setIsEmbed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search || '');
    setIsEmbed(params.get('embed') === '1');
  }, [pathname]);

  if (isEmbed) return null;

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-40 lg:hidden">
        <div className="mx-auto max-w-md px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="rounded-2xl border border-gray-200 bg-white/90 backdrop-blur shadow-2xl overflow-hidden">
            <div className="grid grid-cols-5">
              {navItems.map((item) => {
                const active = isItemActive(pathname, item);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={`flex flex-col items-center justify-center gap-1 py-3 ${
                      active ? 'text-brand-primary' : 'text-gray-700 hover:text-brand-primary'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-[11px] font-semibold">{item.label}</span>
                  </Link>
                );
              })}

              <div
                aria-disabled="true"
                className="flex flex-col items-center justify-center gap-1 py-3 text-gray-400 cursor-not-allowed"
              >
                <Bot className="w-5 h-5" />
                <span className="text-[11px] font-semibold">AI Booking</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="h-32 lg:hidden" aria-hidden="true" />
    </>
  );
}
