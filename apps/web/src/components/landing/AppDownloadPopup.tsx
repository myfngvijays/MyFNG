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

const POPUP_VIEWS_KEY = 'myfng_app_download_popup_views_navratri_v2';
const MAX_VIEWS = 2;
const OPEN_DELAY_MS = 4000;
const SCROLL_TRIGGER = 0.6;
const EXCLUDED_PATH_PREFIXES = ['/book-service'];

const NAVRATRI_POPUP_UTM = {
  utm_source: 'myfng',
  utm_medium: 'popup',
  utm_campaign: 'navratri',
} as const;

const DEFAULT_GO_HREF =
  '/go/myfngapp?utm_source=myfng&utm_medium=popup&utm_campaign=navratri&utm_content=app-download-popup';

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
    setGoHref(buildGoAppDownloadHref('app-download-popup', NAVRATRI_POPUP_UTM));
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

        <div className="overflow-hidden rounded-[28px] bg-[#fff8ef] shadow-2xl ring-1 ring-[#e7c27a]">
          <div className="grid sm:grid-cols-[210px_1fr] lg:grid-cols-[248px_1fr]">
            <div className="relative flex flex-col items-center overflow-hidden bg-gradient-to-b from-[#6b1224] via-[#9a3412] to-[#c2410c] px-3 pb-2 pt-5 sm:min-h-[460px] sm:px-4 sm:pb-4">
              <div className="pointer-events-none absolute -left-8 top-10 h-24 w-24 rounded-full border border-[#f6d48a]/30" />
              <div className="pointer-events-none absolute -right-6 bottom-16 h-20 w-20 rounded-full bg-[#fbbf24]/20 blur-2xl" />
              <p className="text-[10px] font-semibold uppercase tracking-[0.38em] text-[#fde68a] sm:text-[11px]">
                Navratri
              </p>
              <p
                className="mt-1 text-4xl font-black italic leading-none text-[#fff7d6] sm:text-5xl"
                style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
              >
                Offer
              </p>
              <div className="mt-3 h-px w-14 bg-gradient-to-r from-transparent via-[#f6d48a] to-transparent" />
              <Image
                src="/media/navratri-durga-popup.png"
                alt="Navratri"
                width={864}
                height={1152}
                className="relative mt-2 h-44 w-full object-contain object-bottom drop-shadow-2xl sm:mt-3 sm:h-auto sm:flex-1"
                priority
              />
            </div>

            <div className="relative px-5 py-5 sm:px-7 sm:py-6">
              <h2 className="text-[1.7rem] font-extrabold leading-none tracking-tight text-[#3f0d18] sm:text-[2rem]">
                Download MyFNG App
              </h2>
              <p className="mt-3 text-sm font-semibold text-[#b45309] sm:text-lg">
                Get 10% OFF on Your First Service!
              </p>
              <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-[#f0c36a] bg-[#fff4d8] px-3 py-1.5 text-[11px] font-extrabold text-[#9a3412]">
                <Clock className="h-3.5 w-3.5" />
                LIMITED TIME OFFER
              </div>

              <div className="mt-4 flex items-center gap-4">
                <div className="grid min-w-0 flex-1 grid-cols-1 gap-2">
                  {BENEFITS.map((text) => (
                    <div key={text} className="flex items-center gap-2 rounded-xl bg-white px-2.5 py-2 text-sm text-[#3f0d18] ring-1 ring-[#f3d7a1]">
                      <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[#9a3412] text-[11px] font-extrabold text-white">
                        ✓
                      </span>
                      {text}
                    </div>
                  ))}
                </div>
                <div className="hidden w-[104px] flex-shrink-0 sm:block">
                  <div className="relative h-[210px] overflow-hidden rounded-[1.5rem] border-[4px] border-[#2a211c] bg-black shadow-xl">
                    <div className="absolute left-1/2 top-1.5 z-10 h-3 w-12 -translate-x-1/2 rounded-full bg-black" />
                    <Image
                      src="/myfng-app-screenshot.png"
                      alt="MyFNG App"
                      width={400}
                      height={800}
                      className="h-full w-full object-cover object-top"
                    />
                  </div>
                </div>
              </div>

              <a
                href={goHref}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#9a3412] px-6 py-3.5 text-base font-extrabold text-white shadow-lg transition-all hover:bg-[#7c2d12] sm:w-auto"
              >
                <Download className="h-5 w-5" />
                Download App
              </a>
            </div>
          </div>

          <div className="border-t border-[#f3d7a1] bg-white px-4 py-3 sm:px-6">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {TRUST.map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center justify-center gap-1.5">
                  <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#fff4d8] text-[#9a3412] ring-1 ring-[#f0c36a] sm:h-7 sm:w-7">
                    <Icon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  </div>
                  <span className="text-[10px] font-medium text-[#3f0d18] sm:text-xs">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
