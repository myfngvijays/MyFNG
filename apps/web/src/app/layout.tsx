import type { Metadata, Viewport } from 'next';
import { cache } from 'react';
import Script from 'next/script';
import { Toaster } from 'react-hot-toast';
import MobileBottomNav from '@/components/landing/MobileBottomNav';
import UiDensityController from '@/components/UiDensityController';
import DevStaleCacheGuard from '@/components/DevStaleCacheGuard';
import {
  buildRootMetadataFromSettings,
  buildSiteViewportFromSettings,
  getSiteTechnicalSeo,
} from '@/lib/site-technical-seo';
import '@fontsource/poppins/400.css';
import '@fontsource/poppins/600.css';
import '@fontsource/poppins/700.css';
import './globals.css';

/** Runs before hydration — drop stale SW/cache/zoom on localhost so normal Chrome matches Incognito. */
const DEV_CACHE_BOOTSTRAP = `(function(){try{var h=location.hostname||'';if(h!=='localhost'&&h!=='127.0.0.1'&&h.indexOf('.local')<0)return;var el=document.documentElement;el.style.setProperty('zoom','1','important');el.classList.remove('ui-density-compact');el.removeAttribute('data-ui-density');if('serviceWorker' in navigator){navigator.serviceWorker.getRegistrations().then(function(rs){for(var i=0;i<rs.length;i++)rs[i].unregister();});}if(window.caches&&caches.keys){caches.keys().then(function(ks){for(var j=0;j<ks.length;j++)caches.delete(ks[j]);});}}catch(e){}})();`;

/** Runs before hydration — avoids oversized flash on Windows dashboards. */
const UI_DENSITY_BOOTSTRAP = `(function(){try{var p=location.pathname||'';if(p.indexOf('/dashboard')!==0)return;if((window.innerWidth||0)<1024)return;var ua=navigator.userAgent||'';var apple=(/Macintosh|Mac OS X|iPhone|iPad|iPod/i.test(ua))&&!/Windows/i.test(ua);if(apple)return;document.documentElement.classList.add('ui-density-compact');document.documentElement.setAttribute('data-ui-density','compact');}catch(e){}})();`;

const seoSettings = cache(getSiteTechnicalSeo);

export async function generateMetadata(): Promise<Metadata> {
  const settings = await seoSettings();
  return buildRootMetadataFromSettings(settings);
}

export async function generateViewport(): Promise<Viewport> {
  const settings = await seoSettings();
  return buildSiteViewportFromSettings(settings);
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans">
        <Script id="dev-cache-bootstrap" strategy="beforeInteractive">
          {DEV_CACHE_BOOTSTRAP}
        </Script>
        <Script id="ui-density-bootstrap" strategy="beforeInteractive">
          {UI_DENSITY_BOOTSTRAP}
        </Script>
        <UiDensityController />
        <DevStaleCacheGuard />
        {children}
        <MobileBottomNav />
        <Toaster
          position="top-center"
          containerStyle={{
            top: 'max(0.75rem, env(safe-area-inset-top))',
            left: 'env(safe-area-inset-left)',
            right: 'env(safe-area-inset-right)',
          }}
          toastOptions={{
            className: 'text-sm !max-w-[min(24rem,calc(100vw-2rem))]',
          }}
        />
      </body>
    </html>
  );
}
