import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function extractNominatimAddress(data: any) {
  const a = data?.address || {};
  const pincodeRaw = String(a.postcode || '').replace(/\D/g, '');
  const pincode = pincodeRaw.length >= 6 ? pincodeRaw.slice(0, 6) : pincodeRaw;
  const city = String(
    a.city || a.town || a.village || a.municipality || a.city_district || a.state_district || a.county || '',
  ).trim();
  const state = String(a.state || a.region || '').trim();
  const area = [a.suburb, a.neighbourhood, a.quarter, a.road, a.residential]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(', ');
  return { pincode, city, state, area };
}

function buildShortLabel(data: any): string {
  const a = data?.address || {};
  const district = a?.state_district || a?.city_district || a?.city || a?.town || a?.county || '';
  const city = a?.city || a?.town || a?.municipality || '';
  const state = a?.state || a?.region || '';
  const area = a?.suburb || a?.neighbourhood || a?.road || '';

  const blob = [city, district, state, area].join(' ').toLowerCase();
  if (/mumbai|thane|navi mumbai|panvel|kalyan|dombivli|badlapur|ambernath|ulhasnagar|bhiwandi|vasai|virar|palghar|mira bhayandar|mira-bhayandar|raigad/.test(blob)) {
    const d = district || city || 'Thane';
    return `${d}, Mumbai`;
  }
  if (/pune|pimpri|chinchwad|hadapsar|wagholi|baner/.test(blob)) {
    const d = district || city || 'Pune';
    return d.toLowerCase() === 'pune' ? 'Pune' : `${d}, Pune`;
  }
  if (/bengaluru|bangalore/.test(blob)) {
    const d = district || city || 'Bangalore';
    return d.toLowerCase().includes('bangalore') || d.toLowerCase().includes('bengaluru') ? 'Bangalore' : `${d}, Bangalore`;
  }

  const part1 = district || city;
  const metro = city && city !== district ? city : '';
  if (part1 && metro && part1.toLowerCase() !== metro.toLowerCase()) {
    return `${part1}, ${metro}`.replace(/\s+/g, ' ').trim().slice(0, 80);
  }
  return String(part1 || state || '').replace(/\s+/g, ' ').trim().slice(0, 80);
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
    )}&lon=${encodeURIComponent(String(lng))}&zoom=16&addressdetails=1`;

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
    const parsed = extractNominatimAddress(data);
    return NextResponse.json(
      {
        success: true,
        displayName: displayName || null,
        shortLabel: shortLabel || null,
        headerLabel: shortLabel || null,
        pincode: parsed.pincode || null,
        city: parsed.city || null,
        state: parsed.state || null,
        area: parsed.area || shortLabel || null,
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
}
