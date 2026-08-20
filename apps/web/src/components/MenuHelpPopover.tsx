'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Info, X } from 'lucide-react';

type MenuHelpPopoverProps = {
  title: string;
  body: string;
  tips?: string[];
  tone?: 'header' | 'sidebar';
  className?: string;
  align?: 'left' | 'right';
};

/**
 * Small "i" button that opens a Notifications-style panel explaining a menu / header control.
 */
export default function MenuHelpPopover({
  title,
  body,
  tips,
  tone = 'header',
  className = '',
  align = 'right',
}: MenuHelpPopoverProps) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const placePanel = () => {
    const btn = btnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const width = Math.min(352, window.innerWidth - 24);
    let left = align === 'left' ? rect.left : rect.right - width;
    left = Math.max(12, Math.min(left, window.innerWidth - width - 12));
    let top = rect.bottom + 8;
    const estimatedHeight = 220;
    if (top + estimatedHeight > window.innerHeight - 12) {
      top = Math.max(12, rect.top - estimatedHeight - 8);
    }
    setCoords({ top, left });
  };

  useLayoutEffect(() => {
    if (!open) return;
    placePanel();
  }, [open, align]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onReposition = () => placePanel();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [open, align]);

  const triggerClass =
    tone === 'sidebar'
      ? 'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/15 text-white/90 ring-1 ring-white/25 hover:bg-white/25 hover:text-white'
      : 'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 ring-1 ring-slate-200 hover:bg-blue-50 hover:text-blue-700 hover:ring-blue-200';

  const panel =
    open && coords && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={panelRef}
            id={panelId}
            role="dialog"
            aria-label={title}
            style={{ position: 'fixed', top: coords.top, left: coords.left, width: Math.min(352, window.innerWidth - 24) }}
            className="z-[10050] rounded-lg border border-gray-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
              <h3 className="text-base font-semibold text-gray-800">{title}</h3>
              <button
                type="button"
                className="rounded p-1 hover:bg-gray-100"
                aria-label="Close"
                onClick={() => setOpen(false)}
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <div className="max-h-[min(360px,50vh)] overflow-y-auto px-4 py-3">
              <p className="text-sm leading-relaxed text-gray-700 whitespace-pre-line">{body}</p>
              {tips && tips.length > 0 ? (
                <ul className="mt-3 space-y-1.5 border-t border-gray-100 pt-3">
                  {tips.map((tip) => (
                    <li key={tip} className="flex gap-2 text-xs text-gray-600">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={rootRef} className={`relative inline-flex ${className}`}>
      <button
        ref={btnRef}
        type="button"
        className={triggerClass}
        aria-label={`What is ${title}?`}
        aria-expanded={open}
        aria-controls={panelId}
        title="Ye kya hai?"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <Info className="h-3.5 w-3.5" strokeWidth={2.5} />
      </button>
      {panel}
    </div>
  );
}
