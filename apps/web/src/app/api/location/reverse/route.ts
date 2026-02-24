import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function buildShortLabel(data: any): string {
  const a = data?.address || {};
  const part1 =
    a?.suburb ||
    a?.neighbourhood ||
    a?.village ||
    a?.town ||
    a?.city ||
    a?.county ||
    a?.state_district ||
    '';
  const part2 = a?.city || a?.town || a?.state || a?.region || '';
  return [part1, part2].filter(Boolean).join(', ').replace(/\s+/g, ' ').trim().slice(0, 80);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lat = Number(searchParams.get('lat'));
    const lng = Number(searchParams.get('lng'));

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json({ error: 'lat/lng required' }, { status: 400 });
    }

    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
      String(lat)
    )}&lon=${encodeURIComponent(String(lng))}&zoom=12&addressdetails=1`;

    const res = await fetch(url, {
      cache: 'no-store',
      headers: {
        // Nominatim requires an identifying UA for server-to-server calls.
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
    const shortLabel = buildShortLabel(data);
    return NextResponse.json(
      {
        success: true,
        displayName: displayName || null,
        shortLabel: shortLabel || null,
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
}
