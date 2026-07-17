'use client';

import { Suspense, useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  captureUtmParamsFromUrl,
  decorateInternalLinks,
  getStoredUtmParams,
  installUtmPassthrough,
} from '@/lib/utm';

function UtmCaptureInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const observerRef = useRef<MutationObserver | null>(null);

  useEffect(() => {
    installUtmPassthrough();
    if (typeof window !== 'undefined') {
      captureUtmParamsFromUrl(window.location.search);
    }
  }, []);

  useEffect(() => {
    const search = searchParams?.toString();
    captureUtmParamsFromUrl(search ? `?${search}` : '');
  }, [pathname, searchParams]);

  useEffect(() => {
    const utm = getStoredUtmParams();
    if (Object.keys(utm).length === 0) return;

    decorateInternalLinks();

    observerRef.current?.disconnect();
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'childList' && m.addedNodes.length > 0) {
          m.addedNodes.forEach((node) => {
            if (node instanceof HTMLElement) {
              decorateInternalLinks(node);
            }
          });
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    observerRef.current = observer;

    return () => observer.disconnect();
  }, [pathname, searchParams]);

  return null;
}

export default function UtmCapture() {
  return (
    <Suspense fallback={null}>
      <UtmCaptureInner />
    </Suspense>
  );
}
