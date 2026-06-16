'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bot, Home, LifeBuoy, Phone, Wrench } from 'lucide-react';
import type { ComponentType } from 'react';

type ServiceSlugInfo = { label: string; prefillCategory: string; prefillQuery: string };

const CAR_SERVICE_SLUG_MAP: Record<string, ServiceSlugInfo> = {
  'periodic-car-service': { label: 'Book Periodic Service', prefillCategory: 'PERIODIC SERVICE', prefillQuery: 'BASIC' },
  'car-engine-service': { label: 'Book Engine Service', prefillCategory: 'ENGINE SERVICE', prefillQuery: 'ENGINE' },
  'car-ac-service': { label: 'Book Car AC Service', prefillCategory: 'AC SERVICE', prefillQuery: 'AC' },
  'car-battery-service': { label: 'Book Battery Service', prefillCategory: 'BATTERY SERVICE', prefillQuery: 'BATTERY' },
  'car-battery': { label: 'Book Battery Service', prefillCategory: 'BATTERY SERVICE', prefillQuery: 'BATTERY' },
  'car-brake-service': { label: 'Book Brake Service', prefillCategory: 'BRAKE SERVICE', prefillQuery: 'BRAKE' },
  'car-clutch-service': { label: 'Book Clutch Service', prefillCategory: 'CLUTCH SERVICE', prefillQuery: 'CLUTCH' },
  'tyre-wheel-care': { label: 'Book Tyre Service', prefillCategory: 'TYRE & WHEEL CARE', prefillQuery: 'TYRE' },
  'car-detailing-service': { label: 'Book Detailing Service', prefillCategory: 'DETAILING SERVICE', prefillQuery: 'DETAIL' },
  'car-denting-painting': { label: 'Book Denting & Painting', prefillCategory: 'DENTING PAINTING', prefillQuery: 'PAINT' },
  'car-electrical-battery-service': { label: 'Book Electrical & Battery Service', prefillCategory: 'ELECTRICAL & BATTERY SERVICE', prefillQuery: 'ELECTRICAL' },
  'car-suspension-steering-service': { label: 'Book Suspension & Steering Service', prefillCategory: 'SUSPENSION & STEERING SERVICE', prefillQuery: 'SUSPENSION' },
};

type NavItem = {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  matchPrefixes: string[];
};

const navItems: NavItem[] = [
  { label: 'Home', href: '/', icon: Home, matchPrefixes: ['/'] },
  { label: 'Services', href: '/services', icon: Wrench, matchPrefixes: ['/services', '/car-services'] },
  { label: 'MISA AI', href: '/ai-booking', icon: Bot, matchPrefixes: ['/ai-booking'] },
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
  const isRsaPage = pathname === '/car-roadside-assitance' || pathname.startsWith('/car-roadside-assitance/');
  const isServicesListPage = pathname === '/services' || pathname.startsWith('/services/');
  const isCarServiceSlugPage = pathname.startsWith('/car-services/') && pathname.split('/').length >= 3 && pathname.split('/')[2] !== '';
  const carServiceSlug = isCarServiceSlugPage ? pathname.split('/')[2] : null;
  const carServiceInfo = carServiceSlug ? CAR_SERVICE_SLUG_MAP[carServiceSlug] : null;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search || '');
    setIsEmbed(params.get('embed') === '1');
  }, [pathname]);

  if (isEmbed) return null;
  if (pathname === '/book-service' || pathname.startsWith('/book-service/')) return null;

  if (isServicesListPage) {
    return (
      <>
        <div className="fixed inset-x-0 bottom-0 z-40 lg:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <Link
            href="/book-service"
            className="flex items-center justify-center gap-2 text-white font-bold text-[15px] no-underline w-full"
            style={{ background: '#1d4ed8', height: 56 }}
          >
            📅 Book Your Service Now
          </Link>
        </div>
        <div className="h-14 lg:hidden" aria-hidden="true" />
      </>
    );
  }

  if (isCarServiceSlugPage && carServiceInfo) {
    const bookUrl = `/book-service?prefill_category=${encodeURIComponent(carServiceInfo.prefillCategory)}&prefill_query=${encodeURIComponent(carServiceInfo.prefillQuery)}`;
    return (
      <>
        <div className="fixed inset-x-0 bottom-0 z-40 lg:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <Link
            href={bookUrl}
            className="flex items-center justify-center gap-2 text-white font-bold text-[15px] no-underline w-full"
            style={{ background: '#1d4ed8', height: 56 }}
          >
            📅 {carServiceInfo.label}
          </Link>
        </div>
        <div className="h-14 lg:hidden" aria-hidden="true" />
      </>
    );
  }

  if (isCarServiceSlugPage && !carServiceInfo) {
    return (
      <>
        <div className="fixed inset-x-0 bottom-0 z-40 lg:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <Link
            href="/book-service"
            className="flex items-center justify-center gap-2 text-white font-bold text-[15px] no-underline w-full"
            style={{ background: '#1d4ed8', height: 56 }}
          >
            📅 Book Your Service Now
          </Link>
        </div>
        <div className="h-14 lg:hidden" aria-hidden="true" />
      </>
    );
  }

  if (isRsaPage) {
    return (
      <>
        <div className="fixed inset-x-0 bottom-0 z-40 lg:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <div className="grid grid-cols-2" style={{ height: 56 }}>
            <a
              href="tel:+919610448949"
              className="flex items-center justify-center gap-2 text-white font-bold text-[15px] no-underline"
              style={{ background: '#cc2900' }}
            >
              📞 Call Now
            </a>
            <a
              href="https://wa.me/919594996161"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 text-white font-bold text-[15px] no-underline"
              style={{ background: '#25D366' }}
            >
              💬 WhatsApp Us
            </a>
          </div>
        </div>
        <div className="h-14 lg:hidden" aria-hidden="true" />
      </>
    );
  }

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-40 lg:hidden">
        <div className="mx-auto max-w-md px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="rounded-2xl backdrop-blur shadow-2xl overflow-hidden border border-[#6f8fe6] bg-[#1f3f98]/95">
            <div className="grid grid-cols-5">
              {navItems.map((item) => {
                const active = isItemActive(pathname, item);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={`flex flex-col items-center justify-center gap-1 py-3 ${
                      active ? 'text-[#4db2ff]' : 'text-white/90 hover:text-white'
                    }`}
                  >
                    <Icon className="w-5 h-5" strokeWidth={3} />
                    <span className="text-[11px] font-semibold">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="h-32 lg:hidden" aria-hidden="true" />
    </>
  );
}
