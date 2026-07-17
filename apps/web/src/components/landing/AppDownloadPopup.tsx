'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  X,
  CheckCircle2,
  Clock,
  Shield,
  HeadphonesIcon,
  Award,
  Percent,
  Wallet,
  Wrench,
  Scan,
  FileCheck,
  MessageCircle,
  CalendarClock,
  ShieldCheck,
} from 'lucide-react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

const POPUP_VIEWS_KEY = 'myfng_app_download_popup_views';
const MAX_VIEWS = 2;
const OPEN_DELAY_MS = 4000;
const SCROLL_TRIGGER = 0.6;
const EXCLUDED_PATH_PREFIXES = ['/book-service'];

function getViewCount(): number {
  if (typeof window === 'undefined') return MAX_VIEWS;
  try {
    const raw = localStorage.getItem(POPUP_VIEWS_KEY);
    const count = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(count) && count >= 0 ? count : 0;
  } catch {
    return MAX_VIEWS;
  }
}

function recordView() {
  try {
    localStorage.setItem(POPUP_VIEWS_KEY, String(getViewCount() + 1));
  } catch {
    // ignore storage errors
  }
}

function isExcludedPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return EXCLUDED_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function canShowPopup(pathname: string | null): boolean {
  return !isExcludedPath(pathname) && getViewCount() < MAX_VIEWS;
}

export default function AppDownloadPopup() {
  const pathname = usePathname();
  const [show, setShow] = useState(false);
  const openedRef = useRef(false);

  const open = useCallback(() => {
    if (openedRef.current || !canShowPopup(pathname)) return;
    openedRef.current = true;
    recordView();
    setShow(true);
  }, [pathname]);

  const close = useCallback(() => {
    setShow(false);
  }, []);

  useEffect(() => {
    openedRef.current = false;
    setShow(false);

    if (!canShowPopup(pathname)) return;

    const timer = window.setTimeout(() => {
      open();
    }, OPEN_DELAY_MS);

    function onScroll() {
      if (openedRef.current) return;

      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollHeight <= 0) return;

      const scrollPercent = window.scrollY / scrollHeight;
      if (scrollPercent >= SCROLL_TRIGGER) {
        window.clearTimeout(timer);
        open();
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('scroll', onScroll);
    };
  }, [pathname, open]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={close}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      <div
        className="relative w-full max-w-3xl animate-in fade-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={close}
          className="absolute -top-3 -right-3 z-10 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white shadow-lg flex items-center justify-center text-gray-600 hover:text-gray-900 hover:scale-110 transition-all"
          aria-label="Close popup"
        >
          <X className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>

        <div className="rounded-2xl overflow-hidden shadow-2xl">
          <div className="bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-800 p-5 sm:p-8">
            <div className="flex flex-col sm:flex-row items-center gap-5 sm:gap-8">
              <div className="hidden sm:flex flex-shrink-0 items-center justify-center">
                <div className="relative w-44 h-[22rem] bg-black rounded-[2.5rem] border-[5px] border-gray-800 shadow-2xl overflow-hidden">
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 w-20 h-5 bg-black rounded-full z-10" />
                  <Image
                    src="/myfng-app-screenshot.png"
                    alt="MyFNG App"
                    width={400}
                    height={800}
                    className="w-full h-full object-cover object-top"
                  />
                </div>
              </div>

              <div className="flex-1 text-center sm:text-left">
                <h2 className="text-2xl sm:text-3xl font-bold text-white mb-1">Download MyFNG App</h2>
                <p className="text-yellow-300 font-semibold text-sm sm:text-base mb-3">
                  Get <span className="text-lg font-bold">MyFNG Prime</span> Membership @ just ₹699/year!
                </p>

                <div className="inline-flex items-center gap-2 bg-yellow-400 text-gray-900 px-3 py-1.5 rounded-full text-xs font-bold mb-3 shadow-lg">
                  <Clock className="w-3.5 h-3.5" />
                  LIMITED TIME OFFER
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 mb-5">
                  {[
                    { icon: Percent, text: '10% Off Periodic Packages' },
                    { icon: Wallet, text: '5% Cashback to Wallet' },
                    { icon: Wrench, text: 'Free Top-Up & Inspection (2x)' },
                    { icon: Scan, text: 'Free Car Scanning (2x)' },
                    { icon: FileCheck, text: 'Free Insurance Claim Help' },
                    { icon: MessageCircle, text: 'Prime Personal WhatsApp Group' },
                    { icon: CalendarClock, text: 'Priority Slot Booking' },
                    { icon: ShieldCheck, text: '6-Month Extended Warranty' },
                  ].map(({ icon: Icon, text }) => (
                    <div key={text} className="flex items-center gap-2 text-white text-xs sm:text-sm">
                      <Icon className="w-3.5 h-3.5 text-yellow-300 flex-shrink-0" />
                      {text}
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
                  <a
                    href="https://play.google.com/store/apps/details?id=com.myfng.app"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-black hover:bg-gray-900 text-white px-4 py-2.5 rounded-lg transition-all hover:scale-105 shadow-lg"
                  >
                    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                      <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 0 1-.61-.92V2.734a1 1 0 0 1 .609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.198l2.807 1.626a1 1 0 0 1 0 1.73l-2.808 1.626L15.206 12l2.492-2.491zM5.864 2.658L16.802 8.99l-2.303 2.303-8.635-8.635z" />
                    </svg>
                    <div className="text-left">
                      <div className="text-[9px] uppercase leading-tight opacity-80">GET IT ON</div>
                      <div className="text-sm font-semibold leading-tight">Google Play</div>
                    </div>
                  </a>

                  <a
                    href="https://apps.apple.com/in/app/myfng-trusted-car-care/id6767495114"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-black hover:bg-gray-900 text-white px-4 py-2.5 rounded-lg transition-all hover:scale-105 shadow-lg"
                  >
                    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                    </svg>
                    <div className="text-left">
                      <div className="text-[9px] uppercase leading-tight opacity-80">Download on the</div>
                      <div className="text-sm font-semibold leading-tight">App Store</div>
                    </div>
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-r from-indigo-900 to-purple-900 px-4 py-3 sm:px-6 sm:py-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              {[
                { icon: Shield, label: 'Trusted Professionals' },
                { icon: Award, label: 'Quality Assured' },
                { icon: CheckCircle2, label: 'Secure Payments' },
                { icon: HeadphonesIcon, label: 'Customer Support' },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-1.5 justify-center">
                  <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-yellow-400 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-gray-900" />
                  </div>
                  <span className="text-white text-[10px] sm:text-xs font-medium">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
