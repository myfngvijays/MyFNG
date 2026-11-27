'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

export const LEAD_DRAWER_WIDTH_KEY = 'myfng:telecaller-lead-drawer-width-px';

const MIN_W = 420;
const LIST_MIN_VISIBLE = 200;

export function defaultTelecallerLeadDrawerWidth(viewportW: number) {
  if (viewportW >= 1536) return Math.min(1360, viewportW - 9 * 16);
  if (viewportW >= 1100) return viewportW - 7 * 16;
  return Math.min(viewportW * 0.96, 1280);
}

function readStoredDrawerWidth(viewportW: number) {
  if (typeof window === 'undefined') return defaultTelecallerLeadDrawerWidth(viewportW);
  const raw = window.localStorage.getItem(LEAD_DRAWER_WIDTH_KEY);
  const n = Number(raw);
  if (!Number.isFinite(n)) return defaultTelecallerLeadDrawerWidth(viewportW);
  const maxW = Math.max(MIN_W, viewportW - LIST_MIN_VISIBLE);
  return Math.min(maxW, Math.max(MIN_W, n));
}

export default function ResizableTelecallerLeadDrawer({
  children,
  'aria-label': ariaLabel = 'Service Lead Details',
}: {
  children: ReactNode;
  'aria-label'?: string;
}) {
  const asideRef = useRef<HTMLElement>(null);
  const [widthPx, setWidthPx] = useState<number | null>(null);
  const dragRef = useRef(false);
  const widthRef = useRef(0);

  useEffect(() => {
    const sync = () => {
      const w = readStoredDrawerWidth(window.innerWidth);
      setWidthPx(w);
      widthRef.current = w;
    };
    sync();
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, []);

  const persist = useCallback((w: number) => {
    try {
      window.localStorage.setItem(LEAD_DRAWER_WIDTH_KEY, String(Math.round(w)));
    } catch {
      /* ignore */
    }
  }, []);

  const onResizePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = true;

    const onMove = (ev: PointerEvent) => {
      if (!dragRef.current) return;
      const maxW = Math.max(MIN_W, window.innerWidth - LIST_MIN_VISIBLE);
      const next = Math.min(maxW, Math.max(MIN_W, window.innerWidth - ev.clientX));
      setWidthPx(next);
      widthRef.current = next;
    };

    const onUp = () => {
      if (!dragRef.current) return;
      dragRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      persist(widthRef.current);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const styleWidth = widthPx ?? undefined;

  return (
    <aside
      ref={asideRef}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      style={styleWidth != null ? { width: styleWidth, maxWidth: '100vw' } : undefined}
      className={`telecaller-lead-drawer relative z-10 flex h-full min-w-0 max-w-[100vw] flex-col border-l border-gray-200 bg-white shadow-2xl ${
        styleWidth == null
          ? 'w-full min-[1100px]:w-[calc(100vw-7rem)] min-[1536px]:w-[min(1360px,calc(100vw-9rem))] sm:w-[min(96vw,1280px)]'
          : 'w-full shrink-0'
      }`}
    >
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize lead drawer"
        title="Drag to resize"
        onPointerDown={onResizePointerDown}
        className="absolute left-0 top-0 z-30 h-full w-3 -translate-x-1/2 cursor-col-resize touch-none select-none hover:bg-[#023D95]/10 active:bg-[#023D95]/20"
      >
        <span
          className="pointer-events-none absolute inset-y-8 left-1/2 w-1 -translate-x-1/2 rounded-full bg-slate-300/90 shadow-sm"
          aria-hidden
        />
      </div>
      {children}
    </aside>
  );
}