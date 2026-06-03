import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function pickShortLabel(result: any): string | null {
  const comps: any[] = Array.isArray(result?.address_components) ? result.address_components : [];
  const byType = (type: string) =>
    comps.find((c) => Array.isArray(c?.types) && c.types.includes(type))?.long_name || '';

  const locality = byType('locality') || byType('sublocality') || byType('administrative_area_level_2');
  const state = byType('administrative_area_level_1');
  const label = [locality, state].filter(Boolean).join(', ').trim();
  return label || null;
}

function extractComponents(result: any) {
  const comps: any[] = Array.isArray(result?.address_components) ? result.address_components : [];
  const byType = (type: string) =>
    comps.find((c) => Array.isArray(c?.types) && c.types.includes(type))?.long_name || '';

  return {
    pincode: byType('postal_code') || '',
    city: byType('locality') || byType('sublocality_level_1') || byType('administrative_area_level_2') || '',
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
        pincode: components?.pincode || null,
        city: components?.city || null,
        state: components?.state || null,
        area: components?.area || null,
        building: components?.building || null,
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
}
