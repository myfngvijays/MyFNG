'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import WebsiteOfferPopupCard from '@/components/landing/WebsiteOfferPopupCard';
import type { WebsiteOfferPopupConfig } from '@/lib/website-offer-popup';

const OPEN_DELAY_MS = 4000;
const SCROLL_TRIGGER = 0.6;

type LivePopup = WebsiteOfferPopupConfig & { href: string };

function storageKey(popup: LivePopup) {
  return `myfng_website_popup_${popup.id}_${popup.starts_at}_${popup.ends_at}`;
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

export default function AppDownloadPopup() {
  const pathname = usePathname();
  const [popup, setPopup] = useState<LivePopup | null>(null);
  const [show, setShow] = useState(false);
  const openedRef = useRef(false);

  useEffect(() => {
    if (!pathname) return;
    let cancelled = false;
    setPopup(null);
    setShow(false);
    openedRef.current = false;
    fetch(`/api/public/website-popup?path=${encodeURIComponent(pathname)}`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        const next = json?.popup;
        if (!next?.headline || !next?.id) {
          setPopup(null);
          return;
        }
        setPopup(next);
      })
      .catch(() => {
        if (!cancelled) setPopup(null);
      });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const open = useCallback(() => {
    if (!popup || openedRef.current) return;
    if (getViewCount(popup) >= popup.max_views) return;
    openedRef.current = true;
    recordView(popup);
    setShow(true);
  }, [popup]);

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
    if (!popup || getViewCount(popup) >= popup.max_views) return;

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
  }, [popup, open]);

  if (!show || !popup) return null;

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto overscroll-contain" onClick={close}>
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" />
      <div className="relative flex min-h-full items-center justify-center p-4 sm:p-6">
        <div className="relative w-full max-w-[340px] sm:max-w-[460px]" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={close}
            className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white text-gray-600 shadow-lg transition-all hover:scale-110 hover:text-gray-900"
            aria-label="Close popup"
          >
            <X className="h-4 w-4" />
          </button>
          <WebsiteOfferPopupCard popup={popup} />
        </div>
      </div>
    </div>
  );
}
