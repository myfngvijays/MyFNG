export type KitPart = { name: string; kind: 'PART' | 'LABOUR' };

export type AdditionalJobKit = {
  key: string;
  title: string;
  match: RegExp;
  parts: KitPart[];
};

export const ADDITIONAL_JOB_KITS: AdditionalJobKit[] = [
  {
    key: 'clutch',
    title: 'Clutch Replace',
    match: /clutch|flywheel|pressure\s*plate|release\s*bearing/i,
    parts: [
      { name: 'Flywheel', kind: 'PART' },
      { name: 'Clutch plate', kind: 'PART' },
      { name: 'Pressure plate', kind: 'PART' },
      { name: 'Clutch wire', kind: 'PART' },
      { name: 'Release bearing', kind: 'PART' },
      { name: 'Clutch labour', kind: 'LABOUR' },
    ],
  },
  {
    key: 'brake',
    title: 'Brake Job',
    match: /brake|caliper|disc|drum|pad/i,
    parts: [
      { name: 'Brake pads', kind: 'PART' },
      { name: 'Brake disc / drum', kind: 'PART' },
      { name: 'Brake oil', kind: 'PART' },
      { name: 'Brake labour', kind: 'LABOUR' },
    ],
  },
  {
    key: 'ac',
    title: 'AC Repair',
    match: /\bac\b|air\s*cond|compressor|gas\s*refill/i,
    parts: [
      { name: 'AC gas refill', kind: 'PART' },
      { name: 'AC filter', kind: 'PART' },
      { name: 'AC labour', kind: 'LABOUR' },
    ],
  },
];

export function kitForJobName(name: string): AdditionalJobKit | null {
  const n = String(name || '').trim();
  if (!n) return null;
  return ADDITIONAL_JOB_KITS.find((k) => k.match.test(n)) || null;
}

export function relatedPartsForJob(name: string, masterNames: string[] = []): KitPart[] {
  const kit = kitForJobName(name);
  const fromKit = kit?.parts || [];
  const extra = masterNames
    .filter((m) => m && m.toLowerCase() !== String(name || '').toLowerCase())
    .filter((m) => (kit ? kit.match.test(m) : false))
    .map((m) => ({ name: m, kind: /labour|labor/i.test(m) ? ('LABOUR' as const) : ('PART' as const) }));
  const seen = new Set(fromKit.map((p) => p.name.toLowerCase()));
  const merged = [...fromKit];
  for (const row of extra) {
    const key = row.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(row);
  }
  return merged;
}
