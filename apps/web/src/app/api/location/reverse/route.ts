import { NextRequest, NextResponse } from 'next/server';
import { pickNominatimAddress } from '@/lib/reverseGeocodeShared';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lat = Number(searchParams.get('lat'));
    const lng = Number(searchParams.get('lng'));

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json({ error: 'lat/lng required' }, { status: 400 });
    }

    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
      String(lat),
    )}&lon=${encodeURIComponent(String(lng))}&zoom=16&addressdetails=1`;

    const res = await fetch(url, {
      cache: 'no-store',
      headers: {
        'User-Agent': 'MyFNG/1.0 (chatbot-reverse-geocode)',
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'reverse geocode failed' }, { status: res.status });
    }

    const data: any = await res.json().catch(() => null);
    if (!data) return NextResponse.json({ error: 'invalid geocode payload' }, { status: 502 });

    const displayName = String(data?.display_name || '').trim();
    const parsed = pickNominatimAddress(data);

    return NextResponse.json(
      {
        success: true,
        displayName: displayName || null,
        shortLabel: parsed.headerLabel || null,
        headerLabel: parsed.headerLabel || null,
        pincode: parsed.pincode || null,
        city: parsed.city || null,
        state: parsed.state || null,
        area: parsed.area || null,
        building: parsed.building || null,
      },
      { status: 200 },
    );
  } catch {
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
}
