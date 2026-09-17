'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  X,
  CheckCircle2,
  Clock,
  Shield,
  HeadphonesIcon,
  Award,
  Download,
} from 'lucide-react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { buildGoAppDownloadHref } from '@/lib/utm';

const POPUP_VIEWS_KEY = 'myfng_app_download_popup_views_ganesh';
const MAX_VIEWS = 2;
const OPEN_DELAY_MS = 4000;
const SCROLL_TRIGGER = 0.6;
const EXCLUDED_PATH_PREFIXES = ['/book-service'];

const GANESH_POPUP_UTM = {
  utm_source: 'myfng',
  utm_medium: 'popup',
  utm_campaign: 'ganesh-chaturthi',
} as const;

const DEFAULT_GO_HREF =
  '/go/myfngapp?utm_source=myfng&utm_medium=popup&utm_campaign=ganesh-chaturthi&utm_content=app-download-popup';

const BENEFITS = [
  'Free Pickup & Drop',
  'Live Service Updates',
  'Transparent Pricing',
  '24/7 Roadside Assistance',
];

const TRUST = [
  { icon: Shield, label: 'Trusted Professionals' },
  { icon: Award, label: 'Quality Assured' },
  { icon: CheckCircle2, label: 'Secure Payments' },
  { icon: HeadphonesIcon, label: 'Customer Support' },
];

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
  const [goHref, setGoHref] = useState(DEFAULT_GO_HREF);
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
    setGoHref(buildGoAppDownloadHref('app-download-popup', GANESH_POPUP_UTM));
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4" onClick={close}>
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" />

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

        <div className="rounded-2xl overflow-hidden shadow-2xl ring-2 ring-amber-300/70">
          <div className="relative bg-gradient-to-br from-[#1d4ed8] via-[#2563eb] to-[#4c1d95] p-5 sm:p-7 overflow-hidden">
            <div className="pointer-events-none absolute -top-16 -right-10 h-48 w-48 rounded-full border-[10px] border-amber-300/15" />
            <div className="pointer-events-none absolute -bottom-10 left-24 h-28 w-28 rounded-full bg-amber-400/10 blur-2xl" />
            <div className="pointer-events-none absolute top-6 left-[38%] h-3 w-3 rounded-full bg-amber-300/80" />
            <div className="pointer-events-none absolute top-16 left-[46%] h-2 w-2 rounded-full bg-orange-400/70" />
            <div className="pointer-events-none absolute bottom-24 right-1/3 h-2.5 w-2.5 rounded-full bg-amber-200/70" />

            <div className="relative flex flex-col sm:flex-row items-center gap-4 sm:gap-5">
              <div className="hidden sm:flex flex-shrink-0 items-center justify-center">
                <div className="relative w-36 h-[19rem] lg:w-40 lg:h-[20.5rem] bg-black rounded-[2.4rem] border-[5px] border-gray-800 shadow-2xl overflow-hidden">
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 w-16 h-4 bg-black rounded-full z-10" />
                  <Image
                    src="/myfng-app-screenshot.png"
                    alt="MyFNG App"
                    width={400}
                    height={800}
                    className="w-full h-full object-cover object-top"
                  />
                </div>
              </div>

              <div className="flex-1 text-center sm:text-left min-w-0">
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight leading-none mb-2">
                  Download MyFNG App
                </h2>
                <p className="text-amber-300 font-semibold text-sm sm:text-lg mb-3">
                  Get 10% OFF on Your First Service!
                </p>

                <div className="inline-flex items-center gap-2 bg-amber-400 text-gray-900 px-3 py-1.5 rounded-full text-[11px] font-extrabold mb-4 shadow-lg">
                  <Clock className="w-3.5 h-3.5" />
                  LIMITED TIME OFFER
                </div>

                <div className="grid grid-cols-1 gap-1.5 mb-5 text-left">
                  {BENEFITS.map((text) => (
                    <div key={text} className="flex items-center gap-2 text-white text-sm">
                      <span className="w-5 h-5 rounded-full bg-amber-400 text-gray-900 flex items-center justify-center text-[11px] font-extrabold flex-shrink-0">
                        ✓
                      </span>
                      {text}
                    </div>
                  ))}
                </div>

                <a
                  href={goHref}
                  className="inline-flex items-center justify-center gap-2 bg-amber-400 hover:bg-amber-300 text-gray-950 px-6 py-3 rounded-xl font-extrabold text-base shadow-lg transition-all hover:scale-105"
                >
                  <Download className="w-5 h-5" />
                  Download App
                </a>
              </div>

              <div className="relative flex-shrink-0 w-40 h-52 sm:w-52 sm:h-[19rem] lg:w-60 lg:h-[21rem] flex flex-col items-center">
                <div className="text-center mb-1 sm:mb-2">
                  <p className="text-[9px] sm:text-[11px] tracking-[0.32em] uppercase text-amber-200/95 font-semibold">
                    ✦ Ganesh Chaturthi ✦
                  </p>
                  <p
                    className="text-2xl sm:text-3xl lg:text-4xl font-black leading-none text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-400 italic"
                    style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
                  >
                    Offer
                  </p>
                  <div className="mx-auto mt-1.5 h-px w-16 bg-gradient-to-r from-transparent via-amber-300 to-transparent" />
                </div>
                <Image
                  src="/media/ganpati-popup.png"
                  alt="Ganpati"
                  width={864}
                  height={1152}
                  className="w-full flex-1 min-h-0 object-contain object-bottom drop-shadow-2xl"
                  priority
                />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-r from-[#1e1b4b] via-[#3b0764] to-[#4c1d95] px-4 py-3 sm:px-6 sm:py-3.5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {TRUST.map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-1.5 justify-center">
                  <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-amber-400 flex items-center justify-center flex-shrink-0">
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
