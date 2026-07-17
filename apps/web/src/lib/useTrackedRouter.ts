'use client';

import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { appendUtmToHref } from '@/lib/utm';

export function useTrackedRouter() {
  const router = useRouter();

  return useMemo(
    () => ({
      ...router,
      push: (href: string, options?: Parameters<typeof router.push>[1]) =>
        router.push(appendUtmToHref(href), options),
      replace: (href: string, options?: Parameters<typeof router.replace>[1]) =>
        router.replace(appendUtmToHref(href), options),
      prefetch: router.prefetch,
      back: router.back,
      forward: router.forward,
      refresh: router.refresh,
    }),
    [router],
  );
}
