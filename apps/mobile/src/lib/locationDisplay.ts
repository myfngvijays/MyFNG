import { buildHeaderLabelFromParsed, getCurrentCoords, reverseGeocodeCoords } from './reverseGeocode';

export async function detectHeaderLocation(): Promise<string> {
  try {
    const coords = await getCurrentCoords();
    if (!coords) return 'India';

    const parsed = await reverseGeocodeCoords(coords.latitude, coords.longitude);
    return buildHeaderLabelFromParsed(parsed);
  } catch {
    return 'India';
  }
}
