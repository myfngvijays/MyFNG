'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ExternalLink, Lock, Smartphone } from 'lucide-react';

type Props = {
  shortCode: string;
  title: string;
  description: string;
  imageUrl: string | null;
  needsPassword: boolean;
  appDeepLink: string | null;
  pixelMetaId: string | null;
  pixelGoogleId: string | null;
  platform: 'ios' | 'android' | 'desktop';
  isQrScan: boolean;
};

export default function ShortLinkLandingClient({
  shortCode,
  title,
  description,
  imageUrl,
  needsPassword,
  appDeepLink,
  pixelMetaId,
  pixelGoogleId,
  platform,
  isQrScan,
}: Props) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (pixelMetaId && typeof window !== 'undefined') {
      try {
        (window as any).fbq?.('track', 'PageView');
      } catch {
        // ignore
      }
    }
  }, [pixelMetaId]);

  useEffect(() => {
    if (!needsPassword && appDeepLink && platform !== 'desktop') {
      const timer = setTimeout(() => {
        window.location.href = appDeepLink;
      }, 400);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [needsPassword, appDeepLink, platform]);

  async function unlock() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/public/short-link/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ short_code: shortCode, password }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Incorrect password');
      const qs = new URLSearchParams();
      if (isQrScan) qs.set('via', 'qr');
      qs.set('go', '1');
      router.replace(`/l/${encodeURIComponent(shortCode)}?${qs.toString()}`);
      router.refresh();
    } catch (e: any) {
      setError(e?.message || 'Unlock failed');
    } finally {
      setBusy(false);
    }
  }

  function continueWeb() {
    const qs = new URLSearchParams();
    if (isQrScan) qs.set('via', 'qr');
    qs.set('go', '1');
    router.push(`/l/${encodeURIComponent(shortCode)}?${qs.toString()}`);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-blue-950 text-white flex items-center justify-center px-4 py-10">
      {pixelMetaId ? (
        <>
          <script
            dangerouslySetInnerHTML={{
              __html: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pixelMetaId}');fbq('track','PageView');`,
            }}
          />
        </>
      ) : null}
      {pixelGoogleId ? (
        <>
          <script async src={`https://www.googletagmanager.com/gtag/js?id=${pixelGoogleId}`} />
          <script
            dangerouslySetInnerHTML={{
              __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${pixelGoogleId}');`,
            }}
          />
        </>
      ) : null}

      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 shadow-2xl">
        <div className="text-xs font-bold uppercase tracking-wider text-blue-200/80 mb-3">MyFNG Link</div>
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="" className="mb-4 h-36 w-full rounded-2xl object-cover" />
        ) : null}
        <h1 className="text-2xl font-black text-white">{title}</h1>
        <p className="mt-2 text-sm text-slate-200 leading-relaxed">{description}</p>

        {needsPassword ? (
          <div className="mt-6 space-y-3">
            <label className="block text-xs font-semibold text-slate-300">
              Password protected
              <div className="mt-1 flex items-center gap-2 rounded-xl border border-white/15 bg-black/20 px-3 py-2">
                <Lock className="h-4 w-4 text-slate-300" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-transparent text-sm text-white outline-none"
                  placeholder="Enter password"
                />
              </div>
            </label>
            {error ? <p className="text-xs text-rose-300">{error}</p> : null}
            <button
              type="button"
              disabled={busy || !password.trim()}
              onClick={() => void unlock()}
              className="w-full rounded-xl bg-blue-500 hover:bg-blue-400 px-4 py-3 text-sm font-bold disabled:opacity-50"
            >
              {busy ? 'Checking…' : 'Unlock & continue'}
            </button>
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {appDeepLink ? (
              <a
                href={appDeepLink}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 px-4 py-3 text-sm font-bold text-white"
              >
                <Smartphone className="h-4 w-4" />
                Open in app
              </a>
            ) : null}
            <button
              type="button"
              onClick={continueWeb}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-500 hover:bg-blue-400 px-4 py-3 text-sm font-bold"
            >
              <ExternalLink className="h-4 w-4" />
              Continue
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
