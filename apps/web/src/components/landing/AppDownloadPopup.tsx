'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { X } from 'lucide-react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

export default function AppDownloadPopup({ pageKey }: { pageKey?: string }) {
  const pathname = usePathname();
  const key = pageKey || pathname;

  const [show, setShow] = useState(false);
  const scrollTriggered = useRef(false);
  const showRef = useRef(false);

  const open = useCallback(() => {
    setShow(true);
    showRef.current = true;
  }, []);

  const close = useCallback(() => {
    setShow(false);
    showRef.current = false;
    sessionStorage.setItem(`app_popup_${key}`, '1');
  }, [key]);

  useEffect(() => {
    scrollTriggered.current = false;
    showRef.current = false;

    const seen = sessionStorage.getItem(`app_popup_${key}`);
    if (!seen) {
      open();
    }
  }, [key, open]);

  useEffect(() => {
    function onScroll() {
      if (scrollTriggered.current || showRef.current) return;

      const scrollPercent =
        window.scrollY / (document.documentElement.scrollHeight - window.innerHeight);

      if (scrollPercent >= 0.6) {
        scrollTriggered.current = true;
        const seen = sessionStorage.getItem(`app_popup_${key}`);
        if (!seen) {
          open();
        }
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [key, open]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={close}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      <div
        className="relative w-full max-w-2xl animate-in fade-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={close}
          className="absolute -top-3 -right-3 z-10 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white shadow-lg flex items-center justify-center text-gray-600 hover:text-gray-900 hover:scale-110 transition-all"
          aria-label="Close popup"
        >
          <X className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>

        <a
          href="https://play.google.com/store/apps/details?id=com.myfng.app"
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-2xl overflow-hidden shadow-2xl"
        >
          <Image
            src="/app-download-popup.png"
            alt="Download MyFNG App - Get 10% OFF on Your First Service"
            width={1024}
            height={683}
            className="w-full h-auto"
            priority
          />
        </a>
      </div>
    </div>
  );
}
