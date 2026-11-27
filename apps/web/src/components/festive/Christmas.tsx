'use client';

import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { DEFAULT_TOP_OFFER_BANNER, type FestiveTheme, type TopOfferBannerConfig } from '@/lib/top-offer-banner';

/**
 * Christmas look for the public website. Switched on/off from
 * Super Admin → Top Offer Banner → Christmas theme + Christmas sound (system_settings website_top_offer_banner).
 */

export type FestivePublicConfig = { theme: FestiveTheme; sound: boolean };

let festiveConfigPromise: Promise<FestivePublicConfig> | null = null;

/** `?festive=christmas` in the URL previews the theme in this browser only (no admin change). */
export function festivePreviewFromUrl(): FestiveTheme | null {
  try {
    const v = new URLSearchParams(window.location.search).get('festive');
    if (v === 'christmas') {
      window.sessionStorage.setItem('myfng_festive_preview', 'christmas');
      return 'christmas';
    }
    if (v === 'none') {
      window.sessionStorage.removeItem('myfng_festive_preview');
      return null;
    }
    return window.sessionStorage.getItem('myfng_festive_preview') === 'christmas' ? 'christmas' : null;
  } catch {
    return null;
  }
}

export function loadFestivePublicConfig(): Promise<FestivePublicConfig> {
  const preview = festivePreviewFromUrl();
  if (preview === 'christmas') {
    const soundOff = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('festive_sound') === '0';
    return Promise.resolve({ theme: 'christmas', sound: !soundOff });
  }
  if (!festiveConfigPromise) {
    festiveConfigPromise = fetch('/api/public/top-offer-banner', { cache: 'no-store' })
      .then((res) => res.json())
      .then((json) => {
        const christmas = json?.config?.festive_theme === 'christmas';
        return {
          theme: (christmas ? 'christmas' : 'none') as FestiveTheme,
          sound: christmas && json?.config?.festive_sound === true,
        };
      })
      .catch(() => ({ theme: 'none' as FestiveTheme, sound: false }));
  }
  return festiveConfigPromise;
}

export function useFestivePublicConfig(): FestivePublicConfig {
  const [cfg, setCfg] = useState<FestivePublicConfig>({ theme: 'none', sound: false });
  useEffect(() => {
    let cancelled = false;
    void loadFestivePublicConfig().then((next) => {
      if (!cancelled) setCfg(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return cfg;
}

/** Current festive theme ('none' until loaded). */
export function useFestiveTheme(): FestiveTheme {
  return useFestivePublicConfig().theme;
}

/** Red–green Christmas colours for the top offer banner (admin colours stay saved for later). */
export function christmasBanner(config: TopOfferBannerConfig): TopOfferBannerConfig {
  if (config.festive_theme !== 'christmas') return config;
  const newYear = isNewYearPhase();
  const headline = newYear
    ? `🎆 ${newYearLabel()}! ${config.headline}`
    : config.headline.startsWith('🎄')
      ? config.headline
      : `🎄 ${config.headline}`;
  return {
    ...DEFAULT_TOP_OFFER_BANNER,
    ...config,
    headline,
    offer_label: newYear
      ? 'New Year countdown →'
      : config.offer_label.includes('❄')
        ? config.offer_label
        : `❄ ${config.offer_label}`,
    text_color: '#ffffff',
    offer_color: '#fde68a',
    background_from: '#b91c1c',
    background_via: '#991b1b',
    background_to: '#166534',
    button_background: '#ffffff',
    button_text: '#b91c1c',
  };
}

/** Small Santa hat that sits on the "C" mark of the MyFNG logo. Parent must be `relative`. */
export function SantaHat({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 52"
      aria-hidden="true"
      className={`pointer-events-none absolute z-10 drop-shadow-sm ${className}`}
    >
      <path d="M8 40 C14 18 30 6 46 10 C52 12 56 18 58 26 L50 30 C46 22 40 20 34 24 C28 28 24 34 22 40 Z" fill="#dc2626" />
      <path d="M46 10 C52 12 56 18 58 26 L50 30 C48 24 46 18 46 10 Z" fill="#b91c1c" />
      <rect x="4" y="36" width="34" height="11" rx="5.5" fill="#ffffff" />
      <circle cx="56" cy="30" r="6" fill="#ffffff" />
    </svg>
  );
}

type Flake = { left: number; size: number; delay: number; duration: number; drift: number; opacity: number };

/**
 * Light CSS snowfall over its `relative` parent (home hero). Few flakes on mobile, none when the
 * visitor prefers reduced motion, and a close button that hides it for the session.
 */
export function ChristmasSnow({ count = 36, onLight = false }: { count?: number; onLight?: boolean }) {
  const [hidden, setHidden] = useState(true);
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const closed = window.sessionStorage.getItem('myfng_snow_closed') === '1';
    setMobile(window.innerWidth < 768);
    setHidden(Boolean(reduced || closed));
  }, []);

  const flakes = useMemo<Flake[]>(() => {
    const n = mobile ? Math.round(count / 3) : count;
    // Deterministic spread so it looks even, not clumped.
    return Array.from({ length: n }, (_, i) => {
      const r = (k: number) => ((Math.sin(i * 12.9898 + k * 78.233) * 43758.5453) % 1 + 1) % 1;
      return {
        left: r(1) * 100,
        size: 3 + r(2) * 5,
        delay: -r(3) * 14,
        duration: 9 + r(4) * 9,
        drift: (r(5) - 0.5) * 60,
        opacity: 0.45 + r(6) * 0.45,
      };
    });
  }, [count, mobile]);

  if (hidden) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-[1] overflow-hidden" aria-hidden="true">
      <style>{`
        @keyframes myfng-snow-fall {
          0% { transform: translate3d(0, -10vh, 0); }
          100% { transform: translate3d(var(--drift), 110vh, 0); }
        }
      `}</style>
      {flakes.map((f, i) => (
        <span
          key={i}
          className="absolute top-0 rounded-full"
          style={
            {
              left: `${f.left}%`,
              width: f.size,
              height: f.size,
              opacity: f.opacity,
              // Light hero background: tinted flakes so they stay visible.
              background: onLight ? '#93c5fd' : '#ffffff',
              boxShadow: onLight ? '0 0 3px rgba(59,130,246,0.35)' : '0 0 4px rgba(255,255,255,0.7)',
              animation: `myfng-snow-fall ${f.duration}s linear ${f.delay}s infinite`,
              ['--drift' as string]: `${f.drift}px`,
            } as React.CSSProperties
          }
        />
      ))}
      <button
        type="button"
        onClick={() => {
          window.sessionStorage.setItem('myfng_snow_closed', '1');
          setHidden(true);
        }}
        className="pointer-events-auto absolute bottom-3 right-3 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/25 text-white hover:bg-black/40"
        aria-label="Stop snowfall"
        title="Stop snowfall"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

/** Festive line shown above the home hero heading (the H1 itself is unchanged for SEO). */
export function ChristmasHeroLine({ className = '' }: { className?: string }) {
  return (
    <p
      className={`inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-red-600 to-green-700 px-4 py-1.5 text-xs font-bold text-white shadow-md sm:text-sm ${className}`}
    >
      <span aria-hidden="true">🎄</span>
      Gift your car a Christmas service
      <span aria-hidden="true">🎁</span>
    </p>
  );
}

/* ───────────────────────── New Year (26 Dec → 1 Jan, IST) ───────────────────────── */

/** Midnight IST of the coming 1 January. */
export function newYearTargetMs(now = Date.now()): number {
  const ist = new Date(now + 5.5 * 3600_000);
  const year = ist.getUTCMonth() === 0 ? ist.getUTCFullYear() : ist.getUTCFullYear() + 1;
  return Date.UTC(year, 0, 1, 0, 0, 0) - 5.5 * 3600_000;
}

/** From 26 Dec (IST) until 2 Jan the Christmas theme switches to New Year wording + countdown. */
export function isNewYearPhase(now = Date.now()): boolean {
  const ist = new Date(now + 5.5 * 3600_000);
  const m = ist.getUTCMonth();
  const d = ist.getUTCDate();
  return (m === 11 && d >= 26) || (m === 0 && d <= 1);
}

export function newYearLabel(now = Date.now()): string {
  return `Happy New Year ${new Date(newYearTargetMs(now)).getUTCFullYear()}`;
}

/* ───────────────────────── Decorations ───────────────────────── */

const BULB_COLORS = ['#ef4444', '#22c55e', '#facc15', '#3b82f6', '#f97316', '#ec4899'];

/** Row of twinkling fairy lights hanging under the header. */
export function FairyLights() {
  return (
    <div className="pointer-events-none relative h-4 w-full overflow-hidden" aria-hidden="true">
      <style>{`
        @keyframes myfng-twinkle { 0%,100% { opacity: 1; filter: brightness(1.15); } 50% { opacity: .35; filter: brightness(.8); } }
      `}</style>
      <svg className="absolute inset-x-0 top-0 h-2 w-full" preserveAspectRatio="none" viewBox="0 0 100 4">
        <path d="M0 0 Q 2.5 3 5 0 T 10 0 T 15 0 T 20 0 T 25 0 T 30 0 T 35 0 T 40 0 T 45 0 T 50 0 T 55 0 T 60 0 T 65 0 T 70 0 T 75 0 T 80 0 T 85 0 T 90 0 T 95 0 T 100 0" fill="none" stroke="#14532d" strokeWidth="0.35" />
      </svg>
      <div className="absolute inset-x-0 top-0 flex justify-between px-[1.25%]">
        {Array.from({ length: 40 }, (_, i) => (
          <span
            key={i}
            className="mt-[3px] block h-2.5 w-1.5 rounded-b-full"
            style={{
              background: BULB_COLORS[i % BULB_COLORS.length],
              boxShadow: `0 0 6px ${BULB_COLORS[i % BULB_COLORS.length]}`,
              animation: `myfng-twinkle ${1.4 + (i % 4) * 0.35}s ease-in-out ${(i % 5) * 0.2}s infinite`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

/** Snow lip on top of a card (with a soft blue edge so it shows on light cards) + a corner ❄. Parent must be `relative`. */
export function SnowCap({ className = '' }: { className?: string }) {
  return (
    <>
      <svg
        viewBox="0 0 200 16"
        preserveAspectRatio="none"
        aria-hidden="true"
        className={`pointer-events-none absolute inset-x-0 top-0 z-10 h-4 w-full ${className}`}
      >
        <path
          d="M0 0 H200 V6 C190 11 184 5 176 9 C168 14 160 6 150 9 C140 13 134 5 124 8 C114 12 106 5 96 9 C86 14 78 6 68 9 C58 13 50 5 40 8 C30 12 22 6 12 9 C6 11 2 8 0 7 Z"
          fill="#ffffff"
          stroke="#93c5fd"
          strokeWidth="1.2"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1.5 z-10 -translate-x-1/2 text-xs text-sky-400">
        ❄
      </span>
    </>
  );
}

/** Snow hanging from the top of the blue footer CTA band + seasonal greeting (white text). */
export function FestiveFooterGreeting() {
  const newYear = isNewYearPhase();
  return (
    <div className="relative -mx-5 -mt-[10px] mb-2">
      <svg viewBox="0 0 1200 40" preserveAspectRatio="none" aria-hidden="true" className="block h-5 w-full sm:h-7">
        <path
          d="M0 0 H1200 V14 C1160 26 1110 8 1050 18 C980 30 940 6 870 16 C800 28 760 6 690 16 C620 28 580 6 510 16 C440 28 400 6 330 16 C260 28 220 6 160 16 C100 26 60 8 0 18 Z"
          fill="#ffffff"
        />
      </svg>
      <p className="mt-2 text-center text-sm font-extrabold text-yellow-200 sm:text-base">
        {newYear ? `🎆 ${newYearLabel()} from MyFNG 🎆` : '🎄 Merry Christmas & Happy New Year from MyFNG 🎄'}
      </p>
    </div>
  );
}

/** Built-in popup shown while the theme is on and no admin popup is live. */
export const CHRISTMAS_COMING_SOON_POPUP = {
  id: 'christmas-coming-soon',
  name: 'Christmas coming soon',
  enabled: true,
  starts_at: '2026-11-01',
  ends_at: '2027-01-02',
  pages: ['all'],
  headline: 'Christmas Offers Coming Soon',
  subtitle: 'Something special for your car this festive season. Stay tuned! 🎁',
  coupon_code: '',
  offer_label: '',
  badge_text: 'LAUNCHING SOON',
  button_text: 'Book a Service Now',
  button_href: '/book-service',
  image_url: '',
  colors: {
    card: '#fffaf5',
    headline: '#b91c1c',
    subtitle: '#166534',
    code_bg: '#b91c1c',
    code_text: '#ffffff',
    offer_bg: '#166534',
    offer_text: '#ffffff',
    badge_bg: '#dcfce7',
    badge_text: '#166534',
    button_bg: '#b91c1c',
    button_text: '#ffffff',
    ring: '#fca5a5',
  },
  utm_source: 'popup',
  utm_medium: 'website',
  utm_campaign: 'christmas-coming-soon',
  max_views: 2,
};
