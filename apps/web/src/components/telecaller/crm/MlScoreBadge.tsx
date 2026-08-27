'use client';

export function mlScoreTone(score?: number | null, temperature?: string | null) {
  const t = String(temperature || '').toLowerCase();
  const n = Number(score);
  if (t === 'hot' || n >= 70) return { bg: '#ffedd5', text: '#9a3412', label: 'Hot' };
  if (t === 'cold' || n < 40) return { bg: '#f1f5f9', text: '#475569', label: 'Cold' };
  return { bg: '#fef3c7', text: '#92400e', label: 'Warm' };
}

export default function MlScoreBadge({
  score,
  temperature,
  compact = false,
}: {
  score?: number | null;
  temperature?: string | null;
  compact?: boolean;
}) {
  if (score == null || !Number.isFinite(Number(score))) return null;
  const n = Math.round(Number(score));
  const tone = mlScoreTone(n, temperature);
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full font-extrabold"
      style={{
        backgroundColor: tone.bg,
        color: tone.text,
        fontSize: compact ? 10 : 11,
        padding: compact ? '2px 7px' : '3px 8px',
      }}
      title={`ML conversion score ${n} (${tone.label})`}
    >
      {n}
      {compact ? null : <span className="font-semibold opacity-80">{tone.label}</span>}
    </span>
  );
}
