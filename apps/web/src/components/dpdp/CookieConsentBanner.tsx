'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  DEFAULT_TRACKER_CONSENT,
  readTrackerConsent,
  writeTrackerConsent,
  type TrackerConsent,
} from '@/lib/dpdp/trackerConsent';

export default function CookieConsentBanner() {
  const [open, setOpen] = useState(false);
  const [customize, setCustomize] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [advertising, setAdvertising] = useState(false);

  useEffect(() => {
    const current = readTrackerConsent();
    if (!current.decidedAt) setOpen(true);
    setAnalytics(current.analytics);
    setAdvertising(current.advertising);
  }, []);

  function persist(next: TrackerConsent) {
    writeTrackerConsent(next);
    setOpen(false);
    void fetch('/api/public/dpdp/consent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'cookie-banner',
        consents: [
          { purpose: 'analytics', granted: next.analytics },
          { purpose: 'advertising', granted: next.advertising },
        ],
      }),
    }).catch(() => undefined);
  }

  if (!open) return null;

  return (
    <div className="pointer-events-none fixed bottom-3 right-3 z-[120] sm:bottom-4 sm:right-4">
      <div className="pointer-events-auto w-[min(19.5rem,calc(100vw-1.5rem))] rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
        <p className="text-[13px] font-semibold text-slate-900">Cookies</p>
        <p className="mt-0.5 text-[11px] leading-snug text-slate-600">
          We use cookies to run the site. Analytics and ads are optional.{' '}
          <Link href="/privacy-notice" className="text-blue-700 underline">
            Notice
          </Link>
        </p>

        {customize ? (
          <div className="mt-2 space-y-1 text-[11px] text-slate-800">
            <label className="flex items-center gap-1.5 text-slate-500">
              <input type="checkbox" checked disabled className="h-3 w-3" />
              Necessary (always on)
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                className="h-3 w-3 accent-blue-700"
                checked={analytics}
                onChange={(e) => setAnalytics(e.target.checked)}
              />
              Analytics
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                className="h-3 w-3 accent-blue-700"
                checked={advertising}
                onChange={(e) => setAdvertising(e.target.checked)}
              />
              Advertising
            </label>
          </div>
        ) : null}

        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            className="rounded-md border border-slate-300 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
            onClick={() =>
              persist({ ...DEFAULT_TRACKER_CONSENT, decidedAt: new Date().toISOString() })
            }
          >
            Reject
          </button>
          <button
            type="button"
            className="rounded-md bg-blue-700 px-2 py-1 text-[11px] font-semibold text-white hover:bg-blue-800"
            onClick={() =>
              persist(
                customize
                  ? { analytics, advertising, decidedAt: new Date().toISOString() }
                  : { analytics: true, advertising: true, decidedAt: new Date().toISOString() },
              )
            }
          >
            {customize ? 'Save' : 'Accept'}
          </button>
          <button
            type="button"
            className="ml-auto text-[11px] font-medium text-blue-700 underline"
            onClick={() => setCustomize((v) => !v)}
          >
            {customize ? 'Hide' : 'Customize'}
          </button>
        </div>
      </div>
    </div>
  );
}
