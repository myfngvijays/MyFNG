'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';

interface AccordionCardProps {
  title: string;
  number?: string;
  defaultOpen?: boolean;
  variant?: 'numbered' | 'bar';
  children: React.ReactNode;
}

export function AccordionCard({ title, number, defaultOpen = false, variant = 'numbered', children }: AccordionCardProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | undefined>(defaultOpen ? undefined : 0);

  const recalc = useCallback(() => {
    if (!contentRef.current) return;
    setHeight(isOpen ? contentRef.current.scrollHeight : 0);
  }, [isOpen]);

  useEffect(() => {
    recalc();
  }, [recalc]);

  useEffect(() => {
    if (!isOpen || !contentRef.current) return;
    const ro = new ResizeObserver(() => {
      if (contentRef.current && isOpen) {
        setHeight(contentRef.current.scrollHeight);
      }
    });
    ro.observe(contentRef.current);
    return () => ro.disconnect();
  }, [isOpen]);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-3 overflow-hidden transition-shadow hover:shadow-md">
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className="w-full flex items-center gap-3 p-4 sm:p-5 text-left cursor-pointer select-none group"
      >
        {variant === 'numbered' && number ? (
          <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-600 text-white text-sm font-bold flex items-center justify-center shadow-sm">
            {number}
          </span>
        ) : (
          <div className="flex-shrink-0 w-1.5 self-stretch rounded-full bg-blue-600" />
        )}
        <span
          className={`flex-1 font-bold text-gray-900 leading-snug ${
            variant === 'bar' ? 'text-base sm:text-lg uppercase tracking-wide' : 'text-base sm:text-lg'
          }`}
        >
          {title}
        </span>
        <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-colors ${isOpen ? 'bg-blue-50' : 'bg-gray-50 group-hover:bg-gray-100'}`}>
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-300 ease-out ${isOpen ? 'rotate-180 text-blue-600' : 'text-gray-400'}`}
          />
        </span>
      </button>
      <div
        ref={contentRef}
        style={{ maxHeight: height !== undefined ? `${height}px` : undefined }}
        className="transition-[max-height,opacity] duration-300 ease-out overflow-hidden"
        aria-hidden={!isOpen}
      >
        <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-0">{children}</div>
      </div>
    </div>
  );
}
