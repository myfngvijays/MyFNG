import { haversineDistanceMeters } from '@/lib/workshop-proximity';
import { filterWorkshopsForPincode, type WorkshopPinRow } from './workshopPincode';

const geoCache = new Map<string, { lat: number; lng: number } | null>();
let lastGeoAt = 0;

/** Indian PIN → lat/lng. Cached. Falls back to null if the lookup fails. */
export async function geocodeIndianPincode(pincode: string): Promise<{ lat: number; lng: number } | null> {
  const pin = String(pincode || '').trim();
  if (!/^\d{6}$/.test(pin)) return null;
  if (geoCache.has(pin)) return geoCache.get(pin) ?? null;

  try {
    const wait = 1100 - (Date.now() - lastGeoAt);
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastGeoAt = Date.now();
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=in&postalcode=${pin}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'MyFNG-workshop-search/1.0' },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as Array<{ lat?: string; lon?: string }>;
    const lat = Number(json?.[0]?.lat);
    const lng = Number(json?.[0]?.lon);
    const point = Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
    geoCache.set(pin, point);
    return point;
  } catch {
    return null;
  }
}

type WorkshopWithGeo = WorkshopPinRow & {
  latitude?: number | string | null;
  longitude?: number | string | null;
  pincode?: string | null;
};

function workshopPoint(workshop: WorkshopWithGeo): { lat: number; lng: number } | null {
  const lat = Number(workshop.latitude);
  const lng = Number(workshop.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return null;
  return { lat, lng };
}

/**
 * Nearest workshops by straight-line distance from the customer PIN.
 * Workshops that only match a saved pin list still appear, but a closer
 * workshop is listed first even when that PIN is not on its list.
 */
export async function rankWorkshopsByDistance<T extends WorkshopWithGeo>(
  workshops: T[],
  pincode: string,
  limit: number,
): Promise<Array<T & { distance_km: number | null }>> {
  const origin = await geocodeIndianPincode(pincode);
  if (!origin) {
    return filterWorkshopsForPincode(workshops, pincode)
      .slice(0, limit)
      .map((w) => ({ ...w, distance_km: null }));
  }

  const ranked: Array<T & { distance_km: number | null }> = [];
  for (const workshop of workshops) {
    let point = workshopPoint(workshop);
    // Only look up a missing pin when this workshop is on the saved list, so Mulund still ranks against Andheri.
    if (!point && filterWorkshopsForPincode([workshop], pincode).length) {
      const ownPin = String(workshop.pincode || '').trim();
      if (/^\d{6}$/.test(ownPin)) point = await geocodeIndianPincode(ownPin);
    }
    if (!point) continue;
    const km = haversineDistanceMeters(origin.lat, origin.lng, point.lat, point.lng) / 1000;
    ranked.push({ ...workshop, distance_km: Math.round(km * 10) / 10 });
  }

  ranked.sort((a, b) => {
    if (a.distance_km == null && b.distance_km == null) return 0;
    if (a.distance_km == null) return 1;
    if (b.distance_km == null) return -1;
    return a.distance_km - b.distance_km;
  });

  const nearby = ranked.filter((w) => w.distance_km != null && w.distance_km <= 25);
  const picked = (nearby.length ? nearby : ranked.filter((w) => w.distance_km != null)).slice(0, limit);
  return picked.length ? picked : ranked.slice(0, limit);
}
