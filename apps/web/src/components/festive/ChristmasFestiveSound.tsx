'use client';

import { useEffect, useState } from 'react';
import { playChristmasBells, startChristmasSoundLoop, stopChristmasSoundLoop } from '@/lib/festive/christmasSound';
import { useFestivePublicConfig } from '@/components/festive/Christmas';

const MUTE_KEY = 'myfng_xmas_sound_off';

export default function ChristmasFestiveSound() {
  const { theme, sound } = useFestivePublicConfig();
  const active = theme === 'christmas' && sound;
  const [muted, setMuted] = useState(false);
  const [needsTap, setNeedsTap] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setMuted(window.sessionStorage.getItem(MUTE_KEY) === '1');
    } catch {
      /* default unmuted */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!active || !ready || muted) {
      stopChristmasSoundLoop();
      setNeedsTap(false);
      return;
    }
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;

    const begin = () => {
      startChristmasSoundLoop();
      setNeedsTap(false);
    };

    let cancelled = false;
    void playChristmasBells().then((started) => {
      if (cancelled) return;
      if (started) {
        begin();
        return;
      }
      setNeedsTap(true);
      const onGesture = () => {
        void playChristmasBells().then((ok) => {
          if (ok) begin();
        });
        window.removeEventListener('pointerdown', onGesture);
        window.removeEventListener('keydown', onGesture);
      };
      window.addEventListener('pointerdown', onGesture, { once: true, passive: true });
      window.addEventListener('keydown', onGesture, { once: true });
    });
    return () => {
      cancelled = true;
      stopChristmasSoundLoop();
    };
  }, [active, ready, muted]);

  if (!active || !ready) return null;

  const toggle = () => {
    const next = !muted;
    setMuted(next);
    try {
      if (next) window.sessionStorage.setItem(MUTE_KEY, '1');
      else window.sessionStorage.removeItem(MUTE_KEY);
    } catch {
      /* ignore */
    }
    if (next) stopChristmasSoundLoop();
    else startChristmasSoundLoop();
  };

  return (
    <div className="pointer-events-none fixed bottom-20 left-3 z-[85] flex flex-col items-start gap-1 sm:bottom-6 sm:left-4">
      {needsTap && !muted ? (
        <button
          type="button"
          onClick={() => {
            void playChristmasBells().then((ok) => {
              if (ok) {
                startChristmasSoundLoop();
                setNeedsTap(false);
              }
            });
          }}
          className="pointer-events-auto rounded-full border border-white/40 bg-red-700/90 px-3 py-1.5 text-[11px] font-bold text-white shadow-lg backdrop-blur-sm"
        >
          🔔 Tap for festive sound
        </button>
      ) : null}
      <button
        type="button"
        onClick={toggle}
        title={muted ? 'Turn Christmas sound on' : 'Mute Christmas sound'}
        aria-label={muted ? 'Turn Christmas sound on' : 'Mute Christmas sound'}
        className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border border-white/50 bg-red-800/90 text-lg text-white shadow-lg backdrop-blur-sm transition hover:bg-red-700"
      >
        {muted ? '🔕' : '🔔'}
      </button>
    </div>
  );
}