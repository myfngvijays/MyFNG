'use client';

import { useEffect } from 'react';

/**
 * Localhost: normal Chrome tabs often keep old Next/CSS (zoom gutters, left-stuck login)
 * while Incognito looks correct. Clear SW + Cache Storage, strip zoom, one reload.
 */
export default function DevStaleCacheGuard() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const host = window.location.hostname;
    const isLocal =
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host.endsWith('.local') ||
      process.env.NODE_ENV === 'development';
    if (!isLocal) return;

    const root = document.documentElement;
    root.style.setProperty('zoom', '1', 'important');
    root.classList.remove('ui-density-compact');
    root.removeAttribute('data-ui-density');
    try {
      document.body?.style.removeProperty('zoom');
    } catch {
      /* ignore */
    }

    const reloadKey = 'myfng_dev_cache_reload_v5';
    void (async () => {
      let dirty = false;
      try {
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          if (regs.length) dirty = true;
          await Promise.all(regs.map((r) => r.unregister()));
        }
      } catch {
        /* ignore */
      }
      try {
        if ('caches' in window) {
          const keys = await caches.keys();
          if (keys.length) dirty = true;
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
      } catch {
        /* ignore */
      }

      // Detect leftover zoom from a stale stylesheet still applied
      try {
        const z = String(getComputedStyle(root).zoom || '1');
        const zNum = parseFloat(z);
        if (z !== '1' && z !== 'normal' && !Number.isNaN(zNum) && zNum < 0.99) {
          dirty = true;
        }
      } catch {
        /* ignore */
      }

      try {
        if (dirty && sessionStorage.getItem(reloadKey) !== '1') {
          sessionStorage.setItem(reloadKey, '1');
          const url = new URL(window.location.href);
          url.searchParams.set('_cb', String(Date.now()));
          window.location.replace(url.toString());
          return;
        }
        // Strip _cb from URL after clean load (optional tidy)
        if (sessionStorage.getItem(reloadKey) === '1') {
          const url = new URL(window.location.href);
          if (url.searchParams.has('_cb')) {
            url.searchParams.delete('_cb');
            window.history.replaceState({}, '', url.pathname + url.search + url.hash);
          }
        }
      } catch {
        /* ignore */
      }
    })();
  }, []);

  return null;
}
