'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  DEFAULT_APP_STORE_URL,
  DEFAULT_PLAY_STORE_URL,
} from '@/lib/mobile-app-version-config';

type Props = {
  code: string;
};

const CUSTOM_SCHEME = 'com.myfng.app';

export default function ReferInviteClient({ code }: Props) {
  const [copied, setCopied] = useState(false);
  const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop'>('desktop');

  useEffect(() => {
    const ua = navigator.userAgent || '';
    if (/iPhone|iPad|iPod/i.test(ua)) setPlatform('ios');
    else if (/Android/i.test(ua)) setPlatform('android');
  }, []);

  useEffect(() => {
    if (!code) return;
    try {
      localStorage.setItem('pending_referral_code', code);
    } catch {
      /* ignore */
    }
  }, [code]);

  const playStoreUrl = useMemo(() => {
    const base = DEFAULT_PLAY_STORE_URL || 'https://play.google.com/store/apps/details?id=com.myfng.app';
    if (!code) return base;
    const sep = base.includes('?') ? '&' : '?';
    return `${base}${sep}referrer=${encodeURIComponent(`referral_code=${code}`)}`;
  }, [code]);

  const appStoreUrl = DEFAULT_APP_STORE_URL || 'https://apps.apple.com/in/app/myfng-trusted-car-care/id6767495114';
  const deepLink = code ? `${CUSTOM_SCHEME}://refer/${encodeURIComponent(code)}` : `${CUSTOM_SCHEME}://`;
  const httpsLink = code ? `https://myfng.in/refer/${encodeURIComponent(code)}` : 'https://myfng.in';

  const copyCode = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  };

  const openApp = () => {
    window.location.href = deepLink;
    const store = platform === 'ios' ? appStoreUrl : platform === 'android' ? playStoreUrl : null;
    if (store) {
      window.setTimeout(() => {
        window.location.href = store;
      }, 1400);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#E8F1FD] via-white to-[#F8FBFF] px-4 py-10">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#004AAD]">MyFNG · Refer & Rise</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900">You&apos;re invited</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Open the MyFNG app and this referral code will be ready. If the app doesn&apos;t open, copy the code and
            apply it in <strong>Refer & Rise</strong>.
          </p>
        </div>

        <div className="rounded-3xl border border-[#D6E8FA] bg-white p-6 shadow-[0_12px_40px_rgba(0,74,173,0.08)]">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#4A6FA5]">Referral code</p>
          <p className="mt-2 break-all font-mono text-3xl font-black tracking-[0.12em] text-slate-900">
            {code || '—'}
          </p>

          <div className="mt-5 flex flex-col gap-3">
            {code ? (
              <button
                type="button"
                onClick={openApp}
                className="inline-flex h-12 items-center justify-center rounded-2xl bg-[#004AAD] px-4 text-sm font-bold text-white"
              >
                Open MyFNG App
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => void copyCode()}
              disabled={!code}
              className="inline-flex h-12 items-center justify-center rounded-2xl border border-[#D6E8FA] bg-[#F8FBFF] px-4 text-sm font-bold text-[#004AAD] disabled:opacity-50"
            >
              {copied ? 'Copied!' : 'Copy code'}
            </button>

            {platform === 'ios' || platform === 'desktop' ? (
              <a
                href={appStoreUrl}
                className="inline-flex h-12 items-center justify-center rounded-2xl bg-slate-900 px-4 text-sm font-bold text-white"
              >
                Download on App Store
              </a>
            ) : null}

            {platform === 'android' || platform === 'desktop' ? (
              <a
                href={playStoreUrl}
                className="inline-flex h-12 items-center justify-center rounded-2xl bg-emerald-600 px-4 text-sm font-bold text-white"
              >
                Get it on Google Play
              </a>
            ) : null}
          </div>

          <p className="mt-5 text-center text-xs leading-5 text-slate-500">
            Already have the app? After login open <strong>Account → Refer & Rise</strong> and paste the code under
            &quot;Have a friend&apos;s code?&quot;.
          </p>
        </div>

        <div className="mt-6 text-center text-xs text-slate-500">
          <Link href="/" className="font-semibold text-[#004AAD]">
            myfng.in
          </Link>
          <span className="mx-2">·</span>
          <a href={httpsLink} className="font-medium text-slate-500">
            Invite link
          </a>
        </div>
      </div>
    </div>
  );
}
