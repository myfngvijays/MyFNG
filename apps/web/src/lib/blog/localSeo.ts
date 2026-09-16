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

export const THANE_AREAS: string[] = [
  'Ghodbunder Road',
  'Manpada',
  'Vartak Nagar',
  'Majiwada',
  'Wagle Estate',
  'Naupada',
  'Hiranandani Estate',
  'Kasarvadavali',
  'Owale',
  'Kalwa',
  'Kopri',
  'Kolshet',
];

export const NAVI_MUMBAI_AREAS: string[] = [
  'Vashi',
  'Nerul',
  'Kharghar',
  'Belapur',
  'Airoli',
  'Koparkhairane',
  'Sanpada',
  'Seawoods',
  'Ulwe',
  'Kamothe',
  'Panvel',
  'Kalamboli',
];

export const MUMBAI_AREAS: string[] = [
  'Andheri',
  'Malad',
  'Borivali',
  'Kandivali',
  'Goregaon',
  'Mulund',
  'Chembur',
  'Dadar',
  'Ghatkopar',
  'Powai',
  'Bandra',
  'Dahisar',
];

export function resolveLocalAreas(seo: any): string[] {
  const city = normalizeCity(seo?.local_city).toLowerCase();
  if (city.includes('navi mumbai') || city.includes('navi-mumbai')) return NAVI_MUMBAI_AREAS.slice();
  if (city.includes('thane')) return THANE_AREAS.slice();
  if (city.includes('mumbai')) return MUMBAI_AREAS.slice();
  if (isPuneOrPcmcCity(city)) return PUNE_PCMC_AREAS.slice();

  const resolved = Array.isArray(seo?.local_areas_resolved) ? seo.local_areas_resolved : [];
  if (resolved.length) return uniqueList(resolved, 60);

  const manual = Array.isArray(seo?.local_areas) ? seo.local_areas : [];
  return uniqueList(manual, 60);
}

