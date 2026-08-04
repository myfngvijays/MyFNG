'use client';

import { useEffect } from 'react';
import { setStoredUtmParams, type UtmParams } from '@/lib/utm';

type Props = {
  slug: string;
  iosUrl: string;
  androidUrl: string;
  utm?: UtmParams;
};

function appendUtmToPath(path: string, utm?: UtmParams): string {
  if (!utm) return path;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(utm)) {
    if (value) params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

export default function AppDownloadGoFallback({ slug, iosUrl, androidUrl, utm }: Props) {
  useEffect(() => {
    if (utm) setStoredUtmParams(utm);
  }, [utm]);

  useEffect(() => {
    const utmKey = JSON.stringify(utm || {});
    const storageKey = `go_page_logged:${slug}:${utmKey}`;
    if (sessionStorage.getItem(storageKey)) return;
    sessionStorage.setItem(storageKey, '1');

    void fetch('/api/public/app-download-click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug,
        platform: 'desktop',
        utm: utm || {},
        source: 'go_fallback_page',
      }),
    }).catch(() => {});
  }, [slug, utm]);

  const trackClick = (platform: 'ios' | 'android') => {
    void fetch('/api/public/app-download-click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug,
        platform,
        utm: utm || {},
        source: 'go_fallback',
      }),
    }).catch(() => {});
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#E8F1FD] to-white flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-3xl bg-white shadow-xl border border-[#004AAD14] p-8 text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#004AAD] text-white text-2xl font-black">
          M
        </div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#004AAD]">MyFNG App</p>
        <h1 className="mt-2 text-2xl font-black text-gray-900">Download MyFNG</h1>
        <p className="mt-3 text-sm leading-6 text-gray-600">
          Book car service, RSA, wallet, Refer &amp; Rise rewards — all in one app.
        </p>

        <div className="mt-8 flex flex-col gap-3">
          <a
            href={iosUrl}
            onClick={() => trackClick('ios')}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-black px-5 py-3 text-sm font-bold text-white hover:bg-gray-900 transition-colors"
          >
            Download on App Store
          </a>
          <a
            href={androidUrl}
            onClick={() => trackClick('android')}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#01875f] px-5 py-3 text-sm font-bold text-white hover:bg-[#016d4d] transition-colors"
          >
            Get it on Google Play
          </a>
        </div>

        <p className="mt-6 text-xs text-gray-500">
          Open this link on your phone to go directly to the right store.
        </p>

        <a
          href={appendUtmToPath('/', utm)}
          className="mt-4 inline-block text-sm font-semibold text-[#004AAD] hover:underline"
        >
          Continue to myfng.in
        </a>
      </div>
    </div>
  );
}
