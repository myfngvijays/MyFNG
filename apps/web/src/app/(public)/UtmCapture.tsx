'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { captureUtmParamsFromUrl } from '@/lib/utm';

export default function UtmCapture() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const search = searchParams?.toString();
    captureUtmParamsFromUrl(search ? `?${search}` : '');
  }, [pathname, searchParams]);

  return null;
}
