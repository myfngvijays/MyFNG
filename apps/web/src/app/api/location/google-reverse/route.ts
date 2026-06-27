import { NextRequest, NextResponse } from 'next/server';
import { pickGoogleComponents } from '@/lib/reverseGeocodeShared';

export const dynamic = 'force-dynamic';

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
      `${lat},${lng}`,
    )}&key=${encodeURIComponent(googleKey)}`;

    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      return NextResponse.json({ error: 'reverse geocode failed' }, { status: res.status });
    }

    const data: any = await res.json().catch(() => null);
    const results: any[] = Array.isArray(data?.results) ? data.results : [];
    const first = results[0] || null;
    const address = first?.formatted_address ? String(first.formatted_address).trim() : '';
    const components = first ? pickGoogleComponents(first) : null;

    return NextResponse.json(
      {
        success: true,
        provider: 'google',
        address: address || null,
        shortLabel: components?.headerLabel || null,
        headerLabel: components?.headerLabel || null,
        pincode: components?.pincode || null,
        city: components?.city || null,
        state: components?.state || null,
        area: components?.area || null,
        building: components?.building || null,
        district: components?.district || null,
      },
      { status: 200 },
    );
  } catch {
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
}
