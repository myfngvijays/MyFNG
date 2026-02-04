import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

function parseLatLngFromGoogleMapsUrl(rawUrl: string): { lat: number; lng: number } | null {
  const s = String(rawUrl || '').trim();
  if (!s) return null;

  // Common patterns:
  // - .../@19.0760,72.8777,17z
  // - ...?q=19.0760,72.8777
  // - ...?query=19.0760,72.8777
  const at = s.match(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
  if (at?.[1] && at?.[2]) {
    const lat = Number(at[1]);
    const lng = Number(at[2]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }

  // Place/share URLs often contain "!3d<lat>!4d<lng>"
  const d3d4d = s.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (d3d4d?.[1] && d3d4d?.[2]) {
    const lat = Number(d3d4d[1]);
    const lng = Number(d3d4d[2]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }

  // Sometimes we get a "center=lat,lng" query param (e.g., og:image URLs)
  const center = s.match(/center=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
  if (center?.[1] && center?.[2]) {
    const lat = Number(center[1]);
    const lng = Number(center[2]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }

  try {
    const u = new URL(s);
    const q = u.searchParams.get('q') || u.searchParams.get('query') || u.searchParams.get('ll');
    if (q) {
      const m = q.match(/(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
      if (m?.[1] && m?.[2]) {
        const lat = Number(m[1]);
        const lng = Number(m[2]);
        if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
      }
    }

    const centerQ = u.searchParams.get('center');
    if (centerQ) {
      const m = centerQ.match(/(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
      if (m?.[1] && m?.[2]) {
        const lat = Number(m[1]);
        const lng = Number(m[2]);
        if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
      }
    }
  } catch {
    // ignore URL parsing
  }

  return null;
}

async function resolveFinalUrl(inputUrl: string): Promise<{ finalUrl: string; html?: string | null }> {
  const url = String(inputUrl || '').trim();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);
  try {
    // Most Google short links are 302/301; fetch follows redirects and Response.url becomes final.
    const res = await fetch(url, {
      redirect: 'follow',
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        'User-Agent': 'MyFNG/1.0 (pincode-from-map)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    const finalUrl = String((res as any).url || url);

    // If we still can't parse coords from URL, a tiny HTML read can help (og tags often include coords).
    const contentType = String(res.headers.get('content-type') || '').toLowerCase();
    if (contentType.includes('text/html')) {
      const text = await res.text().catch(() => '');
      // Keep it small
      const html = text ? text.slice(0, 200_000) : '';
      return { finalUrl, html: html || null };
    }

    return { finalUrl, html: null };
  } finally {
    clearTimeout(timeout);
  }
}

async function reverseGeocodePincode(opts: { lat: number; lng: number }) {
  const googleKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
  const lat = opts.lat;
  const lng = opts.lng;

  // Prefer Google Geocoding API if available.
  if (googleKey) {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${encodeURIComponent(
      `${lat},${lng}`
    )}&key=${encodeURIComponent(googleKey)}`;
    const res = await fetch(url, { cache: 'no-store' });
    const json: any = await res.json().catch(() => ({}));
    const results: any[] = Array.isArray(json?.results) ? json.results : [];

    let postalCode: string | null = null;
    let formattedAddress: string | null = null;

    for (const r of results) {
      if (!formattedAddress && r?.formatted_address) formattedAddress = String(r.formatted_address);
      const comps: any[] = Array.isArray(r?.address_components) ? r.address_components : [];
      const pc = comps.find((c) => Array.isArray(c?.types) && c.types.includes('postal_code'));
      if (pc?.long_name) {
        postalCode = String(pc.long_name).replace(/\D/g, '').slice(0, 6) || null;
        break;
      }
    }

    return { pincode: postalCode, address: formattedAddress, provider: 'google' as const };
  }

  // Fallback: Nominatim reverse geocoding (no API key).
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
    String(lat)
  )}&lon=${encodeURIComponent(String(lng))}&zoom=18&addressdetails=1`;

  const res = await fetch(url, {
    cache: 'no-store',
    headers: {
      // Nominatim requires identifying UA; keep it generic but present.
      'User-Agent': 'MyFNG/1.0 (pincode-from-map)',
      Accept: 'application/json',
    },
  });
  const json: any = await res.json().catch(() => ({}));
  const pcRaw = String(json?.address?.postcode || '').trim();
  const postalCode = pcRaw ? pcRaw.replace(/\D/g, '').slice(0, 6) : '';
  const display = json?.display_name ? String(json.display_name) : null;

  return { pincode: postalCode || null, address: display, provider: 'nominatim' as const };
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClientFromRequest(request);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userProfile = await resolveUserProfile(supabase as any, user as any);
    const roleCode = String((userProfile?.roles as any)?.role_code || '');
    const allowed = new Set(['RSA_MANAGER', 'SUPER_ADMIN', 'SUB_ADMIN']);
    if (!allowed.has(roleCode)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const url = String(searchParams.get('url') || '').trim();
    if (!url) return NextResponse.json({ error: 'url is required' }, { status: 400 });

    const resolved = await resolveFinalUrl(url);
    const latLng =
      parseLatLngFromGoogleMapsUrl(resolved.finalUrl) ||
      (resolved.html ? parseLatLngFromGoogleMapsUrl(resolved.html) : null);
    if (!latLng) {
      return NextResponse.json(
        {
          success: true,
          pincode: null,
          provider: null,
          message: 'Could not extract coordinates from map link',
        },
        { status: 200 }
      );
    }

    const out = await reverseGeocodePincode(latLng);

    return NextResponse.json(
      {
        success: true,
        lat: latLng.lat,
        lng: latLng.lng,
        pincode: out.pincode,
        address: out.address,
        provider: out.provider,
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}

