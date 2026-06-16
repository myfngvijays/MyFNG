import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function getMetroCity(parts: { district?: string; city?: string; state?: string; area?: string }): string {
  const blob = [parts.city, parts.district, parts.state, parts.area].join(' ').toLowerCase();
  if (/mumbai|thane|navi mumbai|panvel|kalyan|dombivli|badlapur|ambernath|ulhasnagar|bhiwandi|vasai|virar|palghar|mira bhayandar|mira-bhayandar|raigad/.test(blob)) {
    return 'Mumbai';
  }
  if (/pune|pimpri|chinchwad|hadapsar|wagholi|baner/.test(blob)) return 'Pune';
  if (/bengaluru|bangalore/.test(blob)) return 'Bangalore';
  if (/delhi|new delhi|noida|gurugram|gurgaon|ghaziabad|faridabad/.test(blob)) return 'Delhi NCR';
  if (/hyderabad|secunderabad/.test(blob)) return 'Hyderabad';
  if (/chennai/.test(blob)) return 'Chennai';
  if (/kolkata|howrah/.test(blob)) return 'Kolkata';
  return parts.city || parts.district || parts.state || 'India';
}

function isWeakAreaName(value: string): boolean {
  const lower = value.toLowerCase();
  return lower.includes('industrial estate') || lower.includes('m.i.d.c') || lower.includes('midc') || lower.length > 28;
}

function formatHeaderLabel(parts: { district?: string; city?: string; state?: string; area?: string }): string | null {
  const metro = getMetroCity(parts);
  const districtCandidates = [parts.district, parts.city, parts.area].filter(Boolean) as string[];
  let district = '';
  for (const candidate of districtCandidates) {
    if (isWeakAreaName(candidate)) continue;
    district = candidate;
    break;
  }
  if (!district) district = parts.district || parts.city || metro;
  if (district.toLowerCase() === metro.toLowerCase()) return metro;
  return `${district}, ${metro}`;
}

function pickShortLabel(result: any): string | null {
  const comps: any[] = Array.isArray(result?.address_components) ? result.address_components : [];
  const byType = (type: string) =>
    comps.find((c) => Array.isArray(c?.types) && c.types.includes(type))?.long_name || '';

  const district = byType('administrative_area_level_2') || byType('locality') || byType('administrative_area_level_3');
  const city = byType('locality') || byType('administrative_area_level_2') || '';
  const state = byType('administrative_area_level_1');
  const area = byType('sublocality_level_2') || byType('sublocality_level_1') || byType('neighborhood') || byType('route') || '';

  return formatHeaderLabel({ district, city, state, area });
}

function extractComponents(result: any) {
  const comps: any[] = Array.isArray(result?.address_components) ? result.address_components : [];
  const byType = (type: string) =>
    comps.find((c) => Array.isArray(c?.types) && c.types.includes(type))?.long_name || '';

  return {
    pincode: byType('postal_code') || '',
    city: byType('locality') || byType('sublocality_level_1') || byType('administrative_area_level_2') || '',
    district: byType('administrative_area_level_2') || byType('administrative_area_level_3') || byType('locality') || '',
    state: byType('administrative_area_level_1') || '',
    area: byType('sublocality_level_2') || byType('sublocality_level_1') || byType('neighborhood') || byType('route') || '',
    building: byType('premise') || byType('subpremise') || '',
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lat = Number(searchParams.get('lat'));
    const lng = Number(searchParams.get('lng'));

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json({ error: 'lat/lng required' }, { status: 400 });
    }

    const googleKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
    if (!googleKey) {
      return NextResponse.json({ error: 'google maps key not configured' }, { status: 503 });
    }

    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${encodeURIComponent(
      `${lat},${lng}`
    )}&key=${encodeURIComponent(googleKey)}`;

    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      return NextResponse.json({ error: 'reverse geocode failed' }, { status: res.status });
    }

    const data: any = await res.json().catch(() => null);
    const results: any[] = Array.isArray(data?.results) ? data.results : [];
    const first = results[0] || null;
    const address = first?.formatted_address ? String(first.formatted_address).trim() : '';
    const shortLabel = first ? pickShortLabel(first) : null;
    const components = first ? extractComponents(first) : null;

    return NextResponse.json(
      {
        success: true,
        provider: 'google',
        address: address || null,
        shortLabel: shortLabel || null,
        headerLabel: shortLabel || null,
        pincode: components?.pincode || null,
        city: components?.city || null,
        state: components?.state || null,
        area: components?.area || null,
        building: components?.building || null,
        district: components?.district || null,
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
}
