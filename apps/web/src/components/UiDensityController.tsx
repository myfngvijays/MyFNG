'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Windows / non-Apple laptops often render the admin UI oversized at 100% zoom
 * (MacBook looks fine). Apply compact rem density on /dashboard only.
 *
 * Important: do not use CSS `zoom` on html — it leaves empty gutters around
 * fixed full-bleed panels (WhatsApp inbox).
 */
function shouldUseCompactDensity(pathname: string | null): boolean {
  if (typeof window === 'undefined') return false;
  if (!pathname?.startsWith('/dashboard')) return false;
  if (window.innerWidth < 1024) return false;

  const ua = navigator.userAgent || '';
  // Real Apple devices — leave at 100% (user confirmed MacBook Pro looks correct)
  const isApple =
    (/Macintosh|Mac OS X/i.test(ua) || /iPhone|iPad|iPod/i.test(ua)) &&
    !/Windows/i.test(ua);
  if (isApple) return false;

  return true;
}

export default function UiDensityController() {
  const pathname = usePathname();

  useEffect(() => {
    const root = document.documentElement;

    const apply = () => {
      const compact = shouldUseCompactDensity(pathname);
      root.classList.toggle('ui-density-compact', compact);
      if (compact) root.setAttribute('data-ui-density', 'compact');
      else root.removeAttribute('data-ui-density');
    };

    apply();
    window.addEventListener('resize', apply);
    return () => {
      window.removeEventListener('resize', apply);
      root.classList.remove('ui-density-compact');
      root.removeAttribute('data-ui-density');
    };
  }, [pathname]);

  return null;
}
