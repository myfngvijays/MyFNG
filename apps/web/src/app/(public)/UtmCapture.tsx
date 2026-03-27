'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { captureUtmParamsFromUrl, decorateInternalLinks, getStoredUtmParams } from '@/lib/utm';

export default function UtmCapture() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const observerRef = useRef<MutationObserver | null>(null);

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
