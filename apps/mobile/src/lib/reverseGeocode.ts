import * as Location from 'expo-location';
import { ENV } from '../config/environment';

export type ParsedReverseAddress = {
  fullAddress: string;
  headerLabel: string;
  nearbyArea: string;
  city: string;
  state: string;
  pincode: string;
  building: string;
};

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

function titleCase(value: string): string {
  return value
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function normalizeText(value: unknown): string {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isStateName(value: string): boolean {
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

function parseDisplayNameFallback(displayName: string, shortLabel: string): ParsedReverseAddress {
  const cleanDisplay = normalizeText(displayName);
  const cleanShort = normalizeText(shortLabel);
  const parts = cleanDisplay.split(',').map((x) => normalizeText(x)).filter(Boolean);
  const pincodeMatch = cleanDisplay.match(/\b(\d{5,6})\b/);
  const pincode = pincodeMatch ? pincodeMatch[1] : '';

  const withoutTail = parts.filter((part) => {
    if (/^\d{5,6}$/.test(part)) return false;
    if (isStateName(part)) return false;
    if (/^(india|united states|usa)$/i.test(part)) return false;
    return true;
  });

  const headerParts = cleanShort.split(',').map((x) => normalizeText(x)).filter(Boolean);
  const city = resolveCityName([
    headerParts[1] || '',
    headerParts[0] || '',
    withoutTail[withoutTail.length - 1] || '',
    withoutTail[withoutTail.length - 2] || '',
  ]);

  let nearbyArea = formatNearbyArea({
    area: withoutTail.slice(0, Math.max(withoutTail.length - 1, 1)).join(', '),
  });
  if (headerParts.length >= 2 && !nearbyArea) {
    nearbyArea = headerParts[0];
  }
  if (nearbyArea && city && nearbyArea.toLowerCase() === city.toLowerCase()) {
    nearbyArea = formatNearbyArea({ area: withoutTail.slice(0, 2).join(', ') });
  }
  if (nearbyArea && city && nearbyArea.toLowerCase() === city.toLowerCase()) {
    nearbyArea = withoutTail[0] || '';
  }

  const statePart = parts.find((part) => isStateName(part)) || parts.find((part, idx) => {
    if (idx === 0) return false;
    const prev = parts[idx - 1]?.toLowerCase() || '';
    return prev === (city || '').toLowerCase();
  }) || '';

  const result: ParsedReverseAddress = {
    fullAddress: cleanDisplay,
    headerLabel: '',
    nearbyArea,
    city,
    state: statePart ? titleCase(statePart) : '',
    pincode,
    building: '',
  };
  result.headerLabel = buildHeaderLabelFromParsed(result);
  return result;
}

export function buildHeaderLabelFromParsed(
  parsed: Pick<ParsedReverseAddress, 'nearbyArea' | 'city' | 'building' | 'headerLabel'>,
): string {
  const areaPart = normalizeText(
    parsed.nearbyArea.split(',')[0] || parsed.building || '',
  );
  const cityPart = normalizeText(parsed.city);

  if (areaPart && cityPart && areaPart.toLowerCase() !== cityPart.toLowerCase()) {
    return formatLocalHeaderLabel(areaPart, cityPart);
  }
  if (cityPart) return titleCase(cityPart);
  if (parsed.headerLabel?.includes(',')) return parsed.headerLabel;
  if (areaPart) return titleCase(areaPart);
  if (parsed.headerLabel && parsed.headerLabel !== 'India') return parsed.headerLabel;
  return 'India';
}

function normalizeApiPayload(data: any): ParsedReverseAddress | null {
  if (!data || data.success === false) return null;

  const fullAddress = normalizeText(data.address || data.displayName || '');
  const apiArea = normalizeText(data.area || '');
  const apiCity = normalizeText(data.city || data.district || '');
  let apiState = normalizeText(data.state || '');
  const apiBuilding = normalizeText(data.building || '');
  let pincode = normalizeText(data.pincode || '').replace(/\D/g, '').slice(0, 6);
  const headerLabelRaw = normalizeText(data.headerLabel || data.shortLabel || '');
  const headerParts = headerLabelRaw.split(',').map((x) => normalizeText(x)).filter(Boolean);

  let nearbyArea = formatNearbyArea({ area: apiArea });
  let city = resolveCityName([apiCity, headerParts[1] || '']);

  if (!city && headerParts.length === 1) {
    city = resolveCityName([headerParts[0], apiCity]);
  } else if (!city && headerParts.length >= 2) {
    city = resolveCityName([headerParts[1], apiCity]);
    if (!nearbyArea) nearbyArea = headerParts[0];
  }

  if (!nearbyArea && headerParts.length >= 2) {
    nearbyArea = headerParts[0];
  }

  if (nearbyArea && city && nearbyArea.toLowerCase() === city.toLowerCase()) {
    nearbyArea = formatNearbyArea({ area: apiArea }) || '';
  }

  if (fullAddress && (!city || !nearbyArea || !pincode)) {
    const fallback = parseDisplayNameFallback(fullAddress, headerLabelRaw);
    if (!city) city = fallback.city;
    if (!nearbyArea) nearbyArea = fallback.nearbyArea;
    if (!pincode) pincode = fallback.pincode;
    if (!apiState && fallback.state) apiState = fallback.state;
  }

  const localArea = nearbyArea.split(',')[0] || apiArea || headerParts[0] || '';

  if (!nearbyArea && !city && !fullAddress && !headerLabelRaw) return null;

  const result: ParsedReverseAddress = {
    fullAddress,
    headerLabel: '',
    nearbyArea,
    city,
    state: apiState && isStateName(apiState) ? titleCase(apiState) : apiState,
    pincode,
    building: apiBuilding,
  };
  result.headerLabel = buildHeaderLabelFromParsed(result);
  return result;
}

async function fetchGoogleReverse(latitude: number, longitude: number): Promise<ParsedReverseAddress | null> {
  try {
    const res = await fetch(
      `${ENV.API_URL}/api/location/google-reverse?lat=${encodeURIComponent(String(latitude))}&lng=${encodeURIComponent(String(longitude))}`,
    );
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    return normalizeApiPayload(data);
  } catch {
    return null;
  }
}

async function fetchNominatimReverse(latitude: number, longitude: number): Promise<ParsedReverseAddress | null> {
  try {
    const res = await fetch(
      `${ENV.API_URL}/api/location/reverse?lat=${encodeURIComponent(String(latitude))}&lng=${encodeURIComponent(String(longitude))}`,
    );
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    const parsed = normalizeApiPayload(data);
    if (parsed) return parsed;

    const displayName = normalizeText(data?.displayName || '');
    const shortLabel = normalizeText(data?.shortLabel || '');
    if (displayName) return parseDisplayNameFallback(displayName, shortLabel);
    return null;
  } catch {
    return null;
  }
}

async function fetchExpoAddress(latitude: number, longitude: number): Promise<Partial<ParsedReverseAddress>> {
  try {
    const places = await Location.reverseGeocodeAsync({ latitude, longitude });
    const p = places?.[0];
    if (!p) return {};

    const street = normalizeText(p.street || '');
    const subLocality = normalizeText((p as any).subLocality || p.district || '');
    const district = subLocality;
    const name = normalizeText(p.name || '');
    const region = normalizeText(p.region || '');
    const cityRaw = normalizeText(p.city || '');
    const postalRaw = normalizeText(p.postalCode || '').replace(/\D/g, '');
    const pincode = postalRaw.length >= 5 ? postalRaw.slice(0, 6) : postalRaw;

    const city = resolveCityName([cityRaw]);
    const state = region ? titleCase(region) : '';

    let nearbyArea = formatNearbyArea({
      road: street,
      suburb: district,
      neighbourhood: name && name.toLowerCase() !== street.toLowerCase() ? name : '',
    });

    if (city && nearbyArea.toLowerCase() === city.toLowerCase()) {
      nearbyArea = street || (name && name.toLowerCase() !== city.toLowerCase() ? name : '') || district;
    }

    let building = '';
    if (
      name &&
      name.toLowerCase() !== street.toLowerCase() &&
      name.toLowerCase() !== cityRaw.toLowerCase() &&
      !isStateName(name)
    ) {
      building = name;
    }

    const localArea = subLocality || nearbyArea.split(',')[0] || name || street;
    const result: Partial<ParsedReverseAddress> = {
      fullAddress: [street, subLocality, cityRaw, region, pincode].filter(Boolean).join(', '),
      nearbyArea,
      city,
      state: isStateName(state) ? state : state,
      pincode,
      building,
    };
    result.headerLabel = buildHeaderLabelFromParsed({
      nearbyArea: result.nearbyArea || '',
      city: result.city || '',
      building: result.building || '',
      headerLabel: '',
    });
    return result;
  } catch {
    return {};
  }
}

function mergeParsed(
  base: ParsedReverseAddress,
  extra: Partial<ParsedReverseAddress>,
): ParsedReverseAddress {
  const nearbyArea =
    base.nearbyArea ||
    extra.nearbyArea ||
    '';
  const city = base.city || extra.city || '';
  const cleanedNearby =
    nearbyArea && city && nearbyArea.toLowerCase() === city.toLowerCase()
      ? extra.nearbyArea || ''
      : nearbyArea;

  const merged: ParsedReverseAddress = {
    fullAddress: base.fullAddress || extra.fullAddress || '',
    headerLabel: '',
    nearbyArea: cleanedNearby || extra.nearbyArea || '',
    city,
    state: base.state || extra.state || '',
    pincode: base.pincode || extra.pincode || '',
    building: base.building || extra.building || '',
  };
  merged.headerLabel = buildHeaderLabelFromParsed(merged);
  return merged;
}

export async function reverseGeocodeCoords(latitude: number, longitude: number): Promise<ParsedReverseAddress> {
  const expo = await fetchExpoAddress(latitude, longitude);

  const google = await fetchGoogleReverse(latitude, longitude);
  if (google && (google.city || google.nearbyArea || google.headerLabel || google.fullAddress)) {
    return mergeParsed(google, expo);
  }

  const nominatim = await fetchNominatimReverse(latitude, longitude);
  if (nominatim) {
    return mergeParsed(nominatim, expo);
  }

  return mergeParsed(
    {
      fullAddress: '',
      headerLabel: 'India',
      nearbyArea: '',
      city: '',
      state: '',
      pincode: '',
      building: '',
    },
    expo,
  );
}

export async function getCurrentCoords(): Promise<{ latitude: number; longitude: number } | null> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return null;

  let position = await Location.getLastKnownPositionAsync({ maxAge: 60_000 }).catch(() => null);
  if (!position) {
    position = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 12_000)),
    ]).catch(() => null);
  }
  if (!position) return null;

  const latitude = Number(position.coords.latitude);
  const longitude = Number(position.coords.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}
