import * as Location from 'expo-location';
import { ENV } from '../config/environment';

type LocationParts = {
  district?: string;
  city?: string;
  state?: string;
  area?: string;
};

function titleCase(value: string): string {
  return value
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function isWeakAreaName(value: string): boolean {
  const lower = value.toLowerCase();
  return (
    lower.includes('industrial estate') ||
    lower.includes('m.i.d.c') ||
    lower.includes('midc') ||
    lower.includes('special economic zone') ||
    lower.length > 28
  );
}

export function getMetroCity(parts: LocationParts): string {
  const blob = [parts.city, parts.district, parts.state, parts.area].join(' ').toLowerCase();

  if (
    /mumbai|thane|navi mumbai|panvel|kalyan|dombivli|badlapur|ambernath|ulhasnagar|bhiwandi|vasai|virar|palghar|mira bhayandar|mira-bhayandar|raigad/.test(
      blob,
    )
  ) {
    return 'Mumbai';
  }
  if (/pune|pimpri|chinchwad|hadapsar|wagholi|baner/.test(blob)) return 'Pune';
  if (/bengaluru|bangalore/.test(blob)) return 'Bangalore';
  if (/delhi|new delhi|noida|gurugram|gurgaon|ghaziabad|faridabad/.test(blob)) return 'Delhi NCR';
  if (/hyderabad|secunderabad/.test(blob)) return 'Hyderabad';
  if (/chennai/.test(blob)) return 'Chennai';
  if (/kolkata|howrah/.test(blob)) return 'Kolkata';

  const fallback = parts.city || parts.district || parts.state || '';
  return fallback ? titleCase(fallback) : 'India';
}

export function formatHeaderLocation(parts: LocationParts): string {
  const metro = getMetroCity(parts);

  const districtCandidates = [parts.district, parts.city, parts.area].filter(Boolean) as string[];
  let district = '';
  for (const candidate of districtCandidates) {
    if (isWeakAreaName(candidate)) continue;
    district = titleCase(candidate);
    break;
  }

  if (!district) {
    district = parts.district ? titleCase(parts.district) : metro;
  }

  if (district.toLowerCase() === metro.toLowerCase()) {
    return metro;
  }

  return `${district}, ${metro}`;
}

function formatFromGooglePayload(data: any): string | null {
  const city = String(data?.city || '').trim();
  const state = String(data?.state || '').trim();
  const area = String(data?.area || '').trim();

  if (!city && !state && !area) return null;

  const district = !isWeakAreaName(city) ? city : state.replace(/\s*Division$/i, '').trim() || city;

  return formatHeaderLocation({
    district,
    city,
    state,
    area,
  });
}

function formatFromExpoPlace(place: Location.LocationGeocodedAddress): string {
  return formatHeaderLocation({
    district: place.district || place.city || undefined,
    city: place.city || undefined,
    state: place.region || place.subregion || undefined,
    area: place.name || place.street || undefined,
  });
}

function formatFromNominatimAddress(addr: Record<string, string>): string {
  const district =
    addr.state_district ||
    addr.city_district ||
    addr.city ||
    addr.town ||
    addr.county ||
    '';
  const city = addr.city || addr.town || addr.municipality || '';
  const state = addr.state || '';

  return formatHeaderLocation({
    district,
    city,
    state,
    area: addr.suburb || addr.neighbourhood || addr.road || '',
  });
}

export async function detectHeaderLocation(): Promise<string> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return 'India';

    let position = await Location.getLastKnownPositionAsync({ maxAge: 60_000 }).catch(() => null);
    if (!position) {
      position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
    }

    const { latitude, longitude } = position.coords;

    try {
      const googleRes = await fetch(
        `${ENV.API_URL}/api/location/google-reverse?lat=${encodeURIComponent(String(latitude))}&lng=${encodeURIComponent(String(longitude))}`,
      );
      if (googleRes.ok) {
        const googleData = await googleRes.json();
        const headerLabel = String(googleData?.headerLabel || '').trim();
        if (headerLabel) return headerLabel;
        const formatted = formatFromGooglePayload(googleData);
        if (formatted) return formatted;
        const shortLabel = String(googleData?.shortLabel || '').trim();
        if (shortLabel) return shortLabel;
      }
    } catch {}

    try {
      const places = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (places[0]) {
        return formatFromExpoPlace(places[0]);
      }
    } catch {}

    try {
      const res = await fetch(
        `${ENV.API_URL}/api/location/reverse?lat=${encodeURIComponent(String(latitude))}&lng=${encodeURIComponent(String(longitude))}`,
      );
      if (res.ok) {
        const data = await res.json();
        const headerLabel = String(data?.headerLabel || '').trim();
        if (headerLabel) return headerLabel;
        const shortLabel = String(data?.shortLabel || '').trim();
        if (shortLabel) return shortLabel;
      }
    } catch {}

    const nominatimRes = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=16&addressdetails=1`,
      { headers: { 'User-Agent': 'MyFNG-App/1.0' } },
    );
    if (nominatimRes.ok) {
      const json = await nominatimRes.json();
      if (json?.address) {
        return formatFromNominatimAddress(json.address);
      }
    }

    return 'India';
  } catch {
    return 'India';
  }
}
