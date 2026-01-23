export const PUNE_PCMC_AREAS: string[] = [
  // Pune core
  'Shivajinagar',
  'Deccan',
  'Camp',
  'Swargate',
  'Kothrud',
  'Karve Nagar',
  'Bavdhan',
  'Pashan',
  'Aundh',
  'Baner',
  'Balewadi',
  'Viman Nagar',
  'Kalyani Nagar',
  'Koregaon Park',
  'Yerawada',
  'Kharadi',
  'Magarpatta',
  'Hadapsar',
  'Wanowrie',
  'Kondhwa',
  'Bibwewadi',
  'Katraj',
  'Sinhagad Road',
  'Dhayari',
  'Narhe',
  'Lohegaon',
  // PCMC / West Pune growth belt
  'Wakad',
  'Hinjawadi',
  'Hinjewadi',
  'Pimpri',
  'Chinchwad',
  'Nigdi',
  'Pimple Saudagar',
  'Pimple Nilakh',
  'Ravet',
  'Akurdi',
  'Thergaon',
  'Tathawade',
];

export function normalizeCity(input: unknown): string {
  return String(input || '').trim();
}

export function isPuneOrPcmcCity(city: unknown): boolean {
  const c = normalizeCity(city).toLowerCase();
  if (!c) return true; // default Pune behavior
  return (
    c === 'pune' ||
    c.includes('pune') ||
    c.includes('pcmc') ||
    c.includes('pimpri') ||
    c.includes('chinchwad') ||
    c.includes('hinjawadi') ||
    c.includes('hinjewadi') ||
    c.includes('wakad')
  );
}

export function uniqueList(items: string[], max = 60): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const v = String(raw || '').trim();
    if (!v) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
    if (out.length >= max) break;
  }
  return out;
}

export function resolveLocalAreas(seo: any): string[] {
  const city = normalizeCity(seo?.local_city);
  if (isPuneOrPcmcCity(city)) return PUNE_PCMC_AREAS.slice();

  const resolved = Array.isArray(seo?.local_areas_resolved) ? seo.local_areas_resolved : [];
  if (resolved.length) return uniqueList(resolved, 60);

  const manual = Array.isArray(seo?.local_areas) ? seo.local_areas : [];
  return uniqueList(manual, 60);
}

