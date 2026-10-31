'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Clock } from 'lucide-react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { DEFAULT_WEBSITE_OFFER_POPUP, type WebsiteOfferPopupConfig } from '@/lib/website-offer-popup';

const OPEN_DELAY_MS = 4000;
const SCROLL_TRIGGER = 0.6;
const EXCLUDED_PATH_PREFIXES = ['/book-service'];

type LivePopup = WebsiteOfferPopupConfig & { href: string };

function storageKey(popup: LivePopup) {
  return `myfng_website_popup_${popup.coupon_code}_${popup.starts_at}_${popup.ends_at}`;
}

function getViewCount(popup: LivePopup): number {
  if (typeof window === 'undefined') return popup.max_views;
  try {
    const raw = localStorage.getItem(storageKey(popup));
    const count = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(count) && count >= 0 ? count : 0;
  } catch {
    return popup.max_views;
  }
}

function recordView(popup: LivePopup) {
  try {
    localStorage.setItem(storageKey(popup), String(getViewCount(popup) + 1));
  } catch {
    // ignore storage errors
  }
}

function isExcludedPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return EXCLUDED_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export default function AppDownloadPopup() {
  const pathname = usePathname();
  const [popup, setPopup] = useState<LivePopup | null>(null);
  const [show, setShow] = useState(false);
  const openedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/public/website-popup')
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        const next = json?.popup;
        if (!next?.headline) {
          setPopup(null);
          return;
        }
        setPopup({ ...DEFAULT_WEBSITE_OFFER_POPUP, ...next });
      })
      .catch(() => {
        if (!cancelled) setPopup(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const open = useCallback(() => {
    if (!popup || openedRef.current || isExcludedPath(pathname)) return;
    if (getViewCount(popup) >= popup.max_views) return;
    openedRef.current = true;
    recordView(popup);
    setShow(true);
  }, [pathname, popup]);

  const close = useCallback(() => {
    setShow(false);
  }, []);

  useEffect(() => {
    if (!show) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [show]);

  useEffect(() => {
    openedRef.current = false;
    setShow(false);
    if (!popup || isExcludedPath(pathname) || getViewCount(popup) >= popup.max_views) return;

    const timer = window.setTimeout(() => {
      open();
    }, OPEN_DELAY_MS);

    function onScroll() {
      if (openedRef.current) return;
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollHeight <= 0) return;
      if (window.scrollY / scrollHeight >= SCROLL_TRIGGER) {
        window.clearTimeout(timer);
        open();
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('scroll', onScroll);
    };
  }, [pathname, popup, open]);

  if (!show || !popup) return null;

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto overscroll-contain" onClick={close}>
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" />
      <div className="relative flex min-h-full items-center justify-center p-4 sm:p-6">
        <div
          className="relative w-full max-w-[340px] animate-in fade-in zoom-in-95 duration-300 sm:max-w-[460px]"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={close}
            className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white text-gray-600 shadow-lg transition-all hover:scale-110 hover:text-gray-900"
            aria-label="Close popup"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="overflow-hidden rounded-[28px] bg-[#fff8ef] shadow-2xl ring-1 ring-[#e7c27a]">
            {popup.image_url ? (
              <Image
                src={popup.image_url}
                alt={popup.headline}
                width={1600}
                height={800}
                className="h-auto w-full"
                priority
              />
            ) : null}
            <div className="px-5 py-5 text-center sm:px-8 sm:py-6">
              <h2 className="text-3xl font-extrabold tracking-tight text-[#5c1020] sm:text-4xl">{popup.headline}</h2>
              <p className="mt-2 text-sm font-semibold text-[#c2410c] sm:text-base">{popup.subtitle}</p>

              {popup.coupon_code ? (
                <div className="mx-auto mt-4 flex max-w-[320px] overflow-hidden rounded-2xl shadow-md">
                  <div className="flex flex-1 items-center justify-center bg-[#6b1224] px-3 py-4 text-xl font-extrabold tracking-[0.12em] text-[#ffe14a] sm:text-2xl">
                    {popup.coupon_code}
                  </div>
                  <div className="flex w-[42%] items-center justify-center bg-[#ffd000] px-3 py-4 text-center text-xl font-extrabold leading-tight text-[#7a1020] sm:text-2xl">
                    {popup.offer_label}
                  </div>
                </div>
              ) : null}

              {popup.badge_text ? (
                <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[#ffe7a3] px-3 py-1 text-[11px] font-extrabold tracking-wide text-[#9a3412]">
                  <Clock className="h-3.5 w-3.5" />
                  {popup.badge_text}
                </div>
              ) : null}

              <a
                href={popup.href}
                className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-[#6b1224] px-4 py-3 text-base font-extrabold text-[#ffe14a] shadow-lg transition-all hover:bg-[#54101c]"
              >
                {popup.button_text}
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
