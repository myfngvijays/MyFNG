'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Probe = { label: string; ok: boolean; detail: string };

export default function TrackingTestClient() {
  const [probes, setProbes] = useState<Probe[]>([]);

  useEffect(() => {
    const tick = () => {
      const w = window as Window & {
        dataLayer?: unknown[];
        gtag?: unknown;
        fbq?: unknown;
        google_tag_manager?: unknown;
        oaiq?: unknown;
      };
      setProbes([
        {
          label: 'GTM / dataLayer',
          ok: Array.isArray(w.dataLayer) && w.dataLayer.length > 0,
          detail: Array.isArray(w.dataLayer) ? `${w.dataLayer.length} events` : 'not found',
        },
        {
          label: 'gtag()',
          ok: typeof w.gtag === 'function',
          detail: typeof w.gtag === 'function' ? 'ready' : 'not loaded yet',
        },
        {
          label: 'Meta Pixel fbq()',
          ok: typeof w.fbq === 'function',
          detail: typeof w.fbq === 'function' ? 'ready' : 'not loaded yet',
        },
        {
          label: 'google_tag_manager',
          ok: Boolean(w.google_tag_manager),
          detail: w.google_tag_manager ? 'container present' : 'waiting…',
        },
        {
          label: 'OpenAI Ads oaiq()',
          ok: typeof w.oaiq === 'function',
          detail: typeof w.oaiq === 'function' ? 'ready · U2kxzksZVZarMY9GCy9jJV' : 'not loaded yet',
        },
      ]);
    };
    tick();
    const id = window.setInterval(tick, 800);
    const stop = window.setTimeout(() => window.clearInterval(id), 12000);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(stop);
    };
  }, []);

  return (
    <div className="min-h-screen bg-amber-50 px-4 py-10">
      <div className="mx-auto max-w-xl rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
        <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Test page</p>
        <h1 className="mt-1 text-2xl font-black text-slate-900">Tracking fire check</h1>
        <p className="mt-2 text-sm text-slate-600">
          Is page pe GTM / GA4 / Pixel localhost pe bhi load hote hain (cookie skip). Tag Assistant ya Facebook Pixel Helper yahan use karo.
        </p>
        <ul className="mt-5 space-y-2">
          {probes.map((p) => (
            <li
              key={p.label}
              className={`rounded-xl border px-3 py-2 text-sm ${
                p.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-slate-200 bg-slate-50 text-slate-700'
              }`}
            >
              <span className="font-bold">{p.ok ? 'OK' : 'WAIT'}</span> · {p.label}
              <span className="block text-xs opacity-80">{p.detail}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-slate-500">2–8 second wait karo. Phir bhi WAIT ho to IDs / Save check karo.</p>
        <Link href="/dashboard/super_admin/tracking-scripts" className="mt-5 inline-block text-sm font-bold text-violet-700">
          ← Back to Tracking Scripts
        </Link>
      </div>
    </div>
  );
}
