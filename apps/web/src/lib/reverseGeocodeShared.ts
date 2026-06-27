const INDIAN_STATES = new Set([
  'andhra pradesh',
  'arunachal pradesh',
  'assam',
  'bihar',
  'chhattisgarh',
  'goa',
  'gujarat',
  'haryana',
  'himachal pradesh',
  'jharkhand',
  'karnataka',
  'kerala',
  'madhya pradesh',
  'maharashtra',
  'manipur',
  'meghalaya',
  'mizoram',
  'nagaland',
  'odisha',
  'punjab',
  'rajasthan',
  'sikkim',
  'tamil nadu',
  'telangana',
  'tripura',
  'uttar pradesh',
  'uttarakhand',
  'west bengal',
  'delhi',
  'jammu and kashmir',
  'ladakh',
  'puducherry',
  'chandigarh',
]);

function normalizeText(value: unknown): string {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isStateName(value: string): boolean {
  const lower = normalizeText(value).toLowerCase();
  if (!lower) return false;
  return INDIAN_STATES.has(lower) || lower.endsWith(' pradesh') || lower.endsWith(' division');
}

function dedupeParts(parts: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    const cleaned = normalizeText(part);
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
  }
  return out;
}

function isAdministrativeNoise(value: string): boolean {
  const lower = value.toLowerCase();
  return (
    lower.includes('subdistrict') ||
    lower.includes('district') ||
    lower.includes('taluka') ||
    lower.includes('tehsil') ||
    lower.includes('division') ||
    lower.includes('municipal corporation') ||
    lower.includes('metropolitan region')
  );
}

function titleCase(value: string): string {
  return value
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export function formatNearbyArea(parts: {
  road?: string;
  suburb?: string;
  neighbourhood?: string;
  area?: string;
}): string {
  const fromArea = normalizeText(parts.area);
  if (fromArea) {
    const split = fromArea
      .split(',')
      .map((x) => normalizeText(x))
      .filter(Boolean)
      .filter((x) => !isStateName(x) && !isAdministrativeNoise(x) && !/^\d{6}$/.test(x));
    if (split.length >= 2) {
      return dedupeParts(split.slice(0, 2)).join(', ');
    }
    if (split.length === 1) {
      return split[0];
    }
  }

  const candidates = dedupeParts([
    normalizeText(parts.road),
    normalizeText(parts.suburb),
    normalizeText(parts.neighbourhood),
  ]).filter((x) => !isStateName(x) && !isAdministrativeNoise(x));

  return candidates.slice(0, 2).join(', ');
}

export function resolveCityName(candidates: string[]): string {
  for (const candidate of candidates) {
    const cleaned = normalizeText(candidate);
    if (!cleaned) continue;
    if (isStateName(cleaned)) continue;
    if (isAdministrativeNoise(cleaned)) continue;
    if (/^\d{6}$/.test(cleaned)) continue;
    return titleCase(cleaned);
  }
  return '';
}

export function formatLocalHeaderLabel(localArea: string, city: string): string {
  const area = normalizeText(localArea);
  const cityName = normalizeText(city);
  if (area && cityName && area.toLowerCase() !== cityName.toLowerCase()) {
    return `${titleCase(area)}, ${titleCase(cityName)}`;
  }
  if (cityName) return titleCase(cityName);
  if (area) return titleCase(area);
  return 'India';
}

const MEGA_CITIES = new Set(['mumbai', 'delhi', 'new delhi', 'bengaluru', 'bangalore', 'kolkata', 'chennai', 'hyderabad']);

function resolveGoogleCity(parts: {
  locality: string;
  postalTown: string;
  admin2: string;
  admin3: string;
  sublocality1: string;
}): string {
  const locality = normalizeText(parts.locality);
  const localityLower = locality.toLowerCase();

  if (MEGA_CITIES.has(localityLower) && parts.sublocality1) {
    const suburbCity = resolveCityName([parts.sublocality1, parts.admin3, parts.admin2]);
    if (suburbCity && suburbCity.toLowerCase() !== localityLower) {
      return suburbCity;
    }
  }

  return resolveCityName([locality, parts.postalTown, parts.admin3, parts.admin2]);
}

export function pickGoogleComponents(result: any) {
  const comps: any[] = Array.isArray(result?.address_components) ? result.address_components : [];
  const byType = (type: string) =>
    comps.find((c) => Array.isArray(c?.types) && c.types.includes(type))?.long_name || '';

  const route = byType('route');
  const sublocality2 = byType('sublocality_level_2');
  const sublocality1 = byType('sublocality_level_1');
  const neighborhood = byType('neighborhood');
  const locality = byType('locality');
  const postalTown = byType('postal_town');
  const admin2 = byType('administrative_area_level_2');
  const admin3 = byType('administrative_area_level_3');
  const state = byType('administrative_area_level_1');

  const city = resolveGoogleCity({ locality, postalTown, admin2, admin3, sublocality1 });
  let localArea = '';
  let displayCity = city;

  if (sublocality2) {
    localArea = sublocality2;
    displayCity = resolveCityName([sublocality1, locality, admin3, admin2]) || city;
  } else if (sublocality1 && sublocality1.toLowerCase() !== locality.toLowerCase()) {
    localArea = sublocality1;
    displayCity = resolveCityName([locality, postalTown, admin3, admin2]) || city;
  } else {
    localArea = neighborhood || route;
    displayCity = city;
  }

  const nearbyArea = formatNearbyArea({
    road: route,
    suburb: sublocality1 || sublocality2,
    neighbourhood: neighborhood,
    area: [route, sublocality2 || sublocality1 || neighborhood].filter(Boolean).join(', '),
  });
  const building = byType('premise') || byType('subpremise') || byType('establishment') || '';
  const headerLabel = formatLocalHeaderLabel(localArea, displayCity);

  return {
    pincode: byType('postal_code') || '',
    city: displayCity,
    state: state ? titleCase(state) : '',
    district: admin2 || admin3 || locality || '',
    area: nearbyArea,
    building,
    headerLabel,
  };
}

export function pickNominatimAddress(data: any) {
  const a = data?.address || {};
  const pincodeRaw = String(a.postcode || '').replace(/\D/g, '');
  const pincode = pincodeRaw.length >= 5 ? pincodeRaw.slice(0, 6) : pincodeRaw;

  const road = normalizeText(a.road);
  const suburb = normalizeText(a.suburb);
  const neighbourhood = normalizeText(a.neighbourhood || a.quarter);
  const cityDistrict = normalizeText(a.city_district);
  const city = resolveCityName([
    cityDistrict,
    a.city,
    a.town,
    a.village,
    a.municipality,
    a.county,
  ]);
  const state = normalizeText(a.state || a.region || '');

  let localArea = '';
  let displayCity = city;
  if (neighbourhood && suburb) {
    localArea = neighbourhood;
    displayCity = resolveCityName([suburb, cityDistrict, a.city, a.town]) || city;
  } else if (suburb) {
    localArea = suburb;
    displayCity = city;
  } else {
    localArea = neighbourhood || road;
    displayCity = city;
  }

  const nearbyArea = formatNearbyArea({ road, suburb, neighbourhood });
  const building = normalizeText(a.building || a.house || a.apartments || a.residential);
  const headerLabel = formatLocalHeaderLabel(localArea, displayCity);

  return { pincode, city: displayCity, state: state ? titleCase(state) : '', area: nearbyArea, building, headerLabel };
}
