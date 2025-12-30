'use client';

import { useMemo } from 'react';

type Range = { min?: number; max?: number };
type Props = {
  value: string;
  mode: 'chars' | 'words';
  recommended?: Range;
  hardMax?: number;
  label?: string;
  countOverride?: number;
  unitOverride?: string;
};

function countWords(text: string) {
  const t = String(text || '').trim();
  if (!t) return 0;
  return t.split(/\s+/).filter(Boolean).length;
}

export default function LimitHint({
  value,
  mode,
  recommended,
  hardMax,
  label,
  countOverride,
  unitOverride,
}: Props) {
  const { count, withinRecommended, overHardMax } = useMemo(() => {
    const v = String(value || '');
    const computed = mode === 'words' ? countWords(v) : v.length;
    const count = typeof countOverride === 'number' && Number.isFinite(countOverride) ? countOverride : computed;
    const min = recommended?.min;
    const max = recommended?.max;
    const withinRecommended = (min == null || count >= min) && (max == null || count <= max);
    const overHardMax = hardMax != null ? count > hardMax : false;
    return { count, withinRecommended, overHardMax };
  }, [value, mode, recommended?.min, recommended?.max, hardMax, countOverride]);

  const recommendedText =
    recommended?.min != null && recommended?.max != null
      ? `${recommended.min}–${recommended.max}`
      : recommended?.max != null
        ? `≤${recommended.max}`
        : recommended?.min != null
          ? `≥${recommended.min}`
          : '';

  const tone = overHardMax ? 'text-red-600' : withinRecommended ? 'text-slate-500' : 'text-amber-600';
  const unit = unitOverride || (mode === 'words' ? 'words' : 'chars');

  return (
    <div className={`text-[11px] mt-1 ${tone}`}>
      {label ? <span className="font-semibold">{label}: </span> : null}
      <span>
        {count} {unit}
      </span>
      {recommendedText ? <span> • Recommended {recommendedText}</span> : null}
      {hardMax != null ? <span> • Max {hardMax}</span> : null}
    </div>
  );
}


