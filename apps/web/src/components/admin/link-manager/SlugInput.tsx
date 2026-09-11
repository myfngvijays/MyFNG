'use client';

import { useEffect, useRef, useState } from 'react';
import { sanitizeCustomCode } from '@/lib/link-manager/utils';

export type SlugStatus = {
  slug: string;
  checking: boolean;
  taken: boolean;
  available: boolean;
};

export function useSlugAvailability(raw: string, exceptId?: string | null): SlugStatus {
  const slug = sanitizeCustomCode(raw);
  const [state, setState] = useState<Omit<SlugStatus, 'slug'>>({
    checking: false,
    taken: false,
    available: false,
  });

  useEffect(() => {
    if (slug.length < 2) {
      setState({ checking: false, taken: false, available: false });
      return;
    }

    let cancelled = false;
    setState((prev) => ({ ...prev, checking: true }));
    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ code: slug });
        if (exceptId) params.set('except', exceptId);
        const res = await fetch(`/api/super_admin/link-manager/slug?${params.toString()}`);
        const json = await res.json();
        if (cancelled) return;
        setState({
          checking: false,
          taken: Boolean(json.used),
          available: Boolean(json.available),
        });
      } catch {
        if (!cancelled) setState({ checking: false, taken: false, available: false });
      }
    }, 280);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [slug, exceptId]);

  return { slug, ...state };
}

export default function SlugInput({
  value,
  onChange,
  prefix = 'myfng.in/s/',
  exceptId,
  placeholder = 'app-download',
  onStatusChange,
}: {
  value: string;
  onChange: (value: string) => void;
  prefix?: string;
  exceptId?: string | null;
  placeholder?: string;
  onStatusChange?: (status: SlugStatus) => void;
}) {
  const status = useSlugAvailability(value, exceptId);
  const tooShort = Boolean(value.trim()) && status.slug.length < 2;
  const showTaken = status.taken;
  const onStatusChangeRef = useRef(onStatusChange);
  onStatusChangeRef.current = onStatusChange;

  useEffect(() => {
    onStatusChangeRef.current?.(status);
  }, [status.slug, status.checking, status.taken, status.available]);

  return (
    <div className="space-y-1">
      <div
        className={`flex overflow-hidden rounded-xl border ${
          showTaken || tooShort ? 'border-rose-400 ring-2 ring-rose-100' : 'border-gray-200'
        }`}
      >
        <span className="shrink-0 border-r bg-gray-50 px-2.5 py-2 text-[11px] text-gray-500">
          {prefix}
        </span>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-invalid={showTaken || tooShort}
          className={`w-full px-3 py-2 font-mono text-sm outline-none ${
            showTaken || tooShort ? 'text-rose-700' : ''
          }`}
        />
      </div>
      {tooShort ? (
        <p className="text-[11px] font-semibold text-rose-600">Use at least 2 characters (a-z, 0-9, - _)</p>
      ) : showTaken ? (
        <p className="text-[11px] font-semibold text-rose-600">This slug is already used</p>
      ) : status.checking && status.slug.length >= 2 ? (
        <p className="text-[11px] text-gray-400">Checking slug…</p>
      ) : status.available ? (
        <p className="text-[11px] text-emerald-600">Slug is available</p>
      ) : null}
    </div>
  );
}
