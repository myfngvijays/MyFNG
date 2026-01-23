type GeoResolveResult = {
  ok: boolean;
  city: string;
  geo_region?: string;
  geo_placename?: string;
  geo_lat?: number;
  geo_lng?: number;
  local_areas_resolved?: string[];
  error?: string;
};

function uniqCaseInsensitive(list: string[], max = 60): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
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

function getStateShort(components: any[]): string | null {
  for (const c of components || []) {
    const types: string[] = Array.isArray(c?.types) ? c.types : [];
    if (types.includes('administrative_area_level_1')) return String(c?.short_name || '').trim() || null;
  }
  return null;
}

function getStateLong(components: any[]): string | null {
  for (const c of components || []) {
    const types: string[] = Array.isArray(c?.types) ? c.types : [];
    if (types.includes('administrative_area_level_1')) return String(c?.long_name || '').trim() || null;
  }
  return null;
}

async function fetchJson(url: string, timeoutMs: number): Promise<any> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    const text = await res.text().catch(() => '');
    const json = text ? JSON.parse(text) : {};
    return { ok: res.ok, status: res.status, json };
  } finally {
    clearTimeout(t);
  }
}

export async function resolveCityGeoAndLocalities(params: {
  city: string;
  country?: string;
  key: string;
}): Promise<GeoResolveResult> {
  const city = String(params.city || '').trim();
  if (!city) return { ok: false, city: '', error: 'city is required' };

  const key = String(params.key || '').trim();
  if (!key) return { ok: false, city, error: 'GOOGLE_MAPS_API_KEY not set' };

  const country = String(params.country || 'IN').trim() || 'IN';
  const geocodeUrl =
    `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(`${city}, ${country}`)}&key=${encodeURIComponent(key)}`;

  const g = await fetchJson(geocodeUrl, 8000);
  const gStatus = String(g?.json?.status || '');
  const gFirst = Array.isArray(g?.json?.results) ? g.json.results[0] : null;

  const lat = Number(gFirst?.geometry?.location?.lat);
  const lng = Number(gFirst?.geometry?.location?.lng);
  const hasLatLng = Number.isFinite(lat) && Number.isFinite(lng);

  const comps = Array.isArray(gFirst?.address_components) ? gFirst.address_components : [];
  const stateShort = getStateShort(comps);
  const stateLong = getStateLong(comps);

  const geo_region = stateShort && stateShort.length <= 6 ? `IN-${stateShort}` : undefined;
  const geo_placename = stateLong ? `${city}, ${stateLong}` : `${city}, India`;

  // Localities: use Text Search with neighborhood-ish queries (best-effort)
  const areas: string[] = [];
  const queries = [
    `neighborhoods in ${city}`,
    `areas in ${city}`,
    `localities in ${city}`,
  ];

  for (const q of queries) {
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(q)}&key=${encodeURIComponent(key)}`;
    const r = await fetchJson(url, 8000);
    const results = Array.isArray(r?.json?.results) ? r.json.results : [];
    for (const item of results) {
      const name = String(item?.name || '').trim();
      if (name) areas.push(name);
    }
    // If we already got a good list, stop early
    if (uniqCaseInsensitive(areas, 40).length >= 18) break;
  }

  const local_areas_resolved = uniqCaseInsensitive(areas, 60);

  if (!hasLatLng) {
    return {
      ok: false,
      city,
      geo_region,
      geo_placename,
      local_areas_resolved,
      error: `Geocoding failed: ${gStatus || g?.status || 'unknown'}`,
    };
  }

  return {
    ok: true,
    city,
    geo_region,
    geo_placename,
    geo_lat: lat,
    geo_lng: lng,
    local_areas_resolved,
  };
}

