'use client';

import { Suspense, useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { captureUtmParamsFromUrl } from '@/lib/utm';

/** Silently capture utm_* from the landing URL into storage for lead attribution. URLs stay clean. */
function UtmCaptureInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      captureUtmParamsFromUrl(window.location.search);
    }
  }, []);

  useEffect(() => {
    const search = searchParams?.toString();
    captureUtmParamsFromUrl(search ? `?${search}` : '');
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
