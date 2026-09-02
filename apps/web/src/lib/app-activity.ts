export type AppActivityKind = 'event' | 'wallet' | 'booking' | 'membership';

export type AppActivityItem = {
  id: string;
  kind: AppActivityKind;
  at: string;
  title: string;
  body?: string | null;
  group?: string | null;
};

export function friendlyAppEventName(name?: string | null) {
  return String(name || 'App event')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function summarizeAppEventProperties(props: unknown): string | null {
  if (!props || typeof props !== 'object' || Array.isArray(props)) return null;
  const p = props as Record<string, unknown>;
  const preferred = [
    'screen',
    'source',
    'platform',
    'workshop_name',
    'city',
    'amount',
    'plan',
    'code',
    'reason',
  ];
  const bits: string[] = [];
  for (const key of preferred) {
    const v = p[key];
    if (v == null || v === '') continue;
    bits.push(`${key.replace(/_/g, ' ')}: ${String(v)}`);
    if (bits.length >= 4) break;
  }
  if (bits.length) return bits.join(' · ');
  const extra = Object.entries(p)
    .filter(([, v]) => v != null && v !== '' && typeof v !== 'object')
    .slice(0, 3)
    .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${String(v)}`);
  return extra.length ? extra.join(' · ') : null;
}
