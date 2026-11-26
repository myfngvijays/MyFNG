'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

export const LEAD_SIDEBAR_WIDTH_KEY = 'myfng:telecaller-lead-sidebar-width-px';

const DEFAULT_W = 360;
const MIN_W = 260;
const MAX_W = 640;
const HANDLE_W = 14;

function readStoredWidth(): number {
  if (typeof window === 'undefined') return DEFAULT_W;
  const raw = window.localStorage.getItem(LEAD_SIDEBAR_WIDTH_KEY);
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_W;
  return Math.min(MAX_W, Math.max(MIN_W, n));
}

export default function ResizableLeadSidebarLayout({
  main,
  sidebar,
  /** Lead drawer — one outer scroll; swipe/wheel works on full sidebar width */
  unifiedScroll = false,
}: {
  main: ReactNode;
  sidebar: ReactNode;
  unifiedScroll?: boolean;
}) {
  const [sidebarW, setSidebarW] = useState(DEFAULT_W);
  const widthRef = useRef(DEFAULT_W);
  const gridRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  useEffect(() => {
    const w = readStoredWidth();
    setSidebarW(w);
    widthRef.current = w;
  }, []);

  const persistWidth = useCallback((w: number) => {
    widthRef.current = w;
    try {
      window.localStorage.setItem(LEAD_SIDEBAR_WIDTH_KEY, String(Math.round(w)));
    } catch {
      /* ignore */
    }
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    draggingRef.current = true;

    const onMove = (ev: PointerEvent) => {
      if (!draggingRef.current) return;
      const row = gridRef.current;
      if (!row) return;
      const rect = row.getBoundingClientRect();
      const next = Math.min(MAX_W, Math.max(MIN_W, rect.right - ev.clientX));
      setSidebarW(next);
      widthRef.current = next;
    };

    const onUp = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      persistWidth(widthRef.current);
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

  const colScrollCls = unifiedScroll
    ? 'min-w-0'
    : 'lead-page-col min-h-0 min-w-0 overflow-x-hidden overflow-y-auto overscroll-contain';

  return (
    <div
      className={`resizable-lead-layout flex min-w-0 flex-col ${unifiedScroll ? '' : 'min-h-0 flex-1'}`}
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 lg:hidden">
        {main}
        {sidebar}
      </div>
      <div
        ref={gridRef}
        className={`relative hidden min-w-0 lg:grid ${unifiedScroll ? '' : 'min-h-0 flex-1'}`}
        style={{ gridTemplateColumns: `minmax(0, 1fr) ${HANDLE_W}px ${sidebarW}px` }}
      >
        <div className={colScrollCls}>{main}</div>
        <div
          role="separator"
          aria-orientation="vertical"
          aria-valuenow={sidebarW}
          aria-valuemin={MIN_W}
          aria-valuemax={MAX_W}
          aria-label="Resize activity sidebar"
          tabIndex={0}
          onPointerDown={onPointerDown}
          onKeyDown={(e) => {
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
            const delta = e.key === 'ArrowLeft' ? 24 : -24;
            const next = Math.min(MAX_W, Math.max(MIN_W, sidebarW + delta));
            setSidebarW(next);
            persistWidth(next);
          }}
          className="relative z-50 h-full min-h-0 w-full cursor-col-resize touch-none select-none bg-slate-100/40 hover:bg-[#004AAD]/10 active:bg-[#004AAD]/15"
        >
          <span
            className="pointer-events-none absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-slate-300"
            aria-hidden
          />
        </div>
        <div className={`${colScrollCls} bg-[#f4f7fb]/80 pl-1 pr-0.5`}>{sidebar}</div>
      </div>
    </div>
  );
}