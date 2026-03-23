import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

const GOOGLE_API_KEY =
  process.env.GOOGLE_MAPS_API_KEY ||
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
  '';

import { fetchFullGbpLocation } from '@/lib/gbp/parseLocation';

// ─── GBP OAuth helpers ────────────────────────────────────────────────────────

async function readGbpSettings(admin: any, keys: string[]) {
  const { data, error } = await admin
    .from('system_settings')
    .select('setting_key, setting_value')
    .in('setting_key', keys);
  if (error) throw error;
  const map = new Map<string, string>();
  for (const row of data || []) {
    map.set(String((row as any).setting_key), String((row as any).setting_value || ''));
  }
  return map;
}

async function upsertGbpSetting(admin: any, key: string, value: string) {
  const { error } = await admin.from('system_settings').upsert(
    {
      setting_key: key,
      setting_value: value,
      setting_type: 'STRING',
      category: 'INTEGRATIONS',
      description: 'Google Business integration value',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'setting_key' }
  );
  if (error) throw error;
}

async function getGbpAccessToken(): Promise<string | null> {
  try {
    const { supabaseAdmin } = getSupabaseAdmin();
    if (!supabaseAdmin) return null;

    const settings = await readGbpSettings(supabaseAdmin, [
      'google_business_access_token',
      'google_business_refresh_token',
      'google_business_token_expiry',
    ]);

    const currentToken = settings.get('google_business_access_token') || '';
    const refreshToken = settings.get('google_business_refresh_token') || '';
    const expiry = settings.get('google_business_token_expiry') || '';
    const expiryMs = expiry ? new Date(expiry).getTime() : 0;

    if (currentToken && (!expiryMs || Date.now() < expiryMs - 60_000)) {
      return currentToken;
    }
    if (!refreshToken) return null;

    const clientId =
      process.env.GOOGLE_OAUTH_CLIENT_ID ||
      process.env.GOOGLE_CLIENT_ID ||
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
      '';
    const clientSecret =
      process.env.GOOGLE_OAUTH_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || '';
    if (!clientId || !clientSecret) return null;

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }).toString(),
      cache: 'no-store',
    });
    const tokenJson: any = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok || !tokenJson?.access_token) return null;

    const nextToken = String(tokenJson.access_token);
    const expiresIn = Number(tokenJson.expires_in || 3600);
    const nextExpiry = new Date(Date.now() + expiresIn * 1000).toISOString();
    await upsertGbpSetting(supabaseAdmin, 'google_business_access_token', nextToken);
    await upsertGbpSetting(supabaseAdmin, 'google_business_token_expiry', nextExpiry);
    return nextToken;
  } catch {
    return null;
  }
}



const PLACE_DETAILS_FIELDS = [
  'name',
  'formatted_address',
  'formatted_phone_number',
  'international_phone_number',
  'opening_hours',
  'reviews',
  'rating',
  'user_ratings_total',
  'website',
  'url',
  'photos',
  'place_id',
].join(',');

function extractPlaceIdFromUrl(raw: string): string | null {
  const s = String(raw || '').trim();
  if (!s) return null;

  // Pattern: place_id= query param
  const pidMatch = s.match(/[?&]place_id=([A-Za-z0-9_-]+)/);
  if (pidMatch?.[1]) return pidMatch[1];

  // Pattern: ftid= (used in some Google Maps share links)
  const ftidMatch = s.match(/ftid=([A-Za-z0-9_:.-]+)/);
  if (ftidMatch?.[1]) return ftidMatch[1];

  // Pattern: !1s in data params (e.g., ...!1s0x3be7c...:0x...)
  const dataMatch = s.match(/!1s(0x[0-9a-fA-F]+:0x[0-9a-fA-F]+)/);
  if (dataMatch?.[1]) return dataMatch[1];

  return null;
}

function extractPlaceNameFromUrl(raw: string): string | null {
  const s = String(raw || '').trim();
  if (!s) return null;

  // Pattern: /place/PLACE_NAME/@... or /place/PLACE_NAME/...
  const placeMatch = s.match(/\/place\/([^/@]+)/);
  if (placeMatch?.[1]) {
    return decodeURIComponent(placeMatch[1]).replace(/\+/g, ' ');
  }

  // Pattern: /maps?q=QUERY
  try {
    const u = new URL(s);
    const q = u.searchParams.get('q') || u.searchParams.get('query');
    if (q && !/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(q.trim())) {
      return q;
    }
  } catch {
    // not a valid URL
  }

  return null;
}

async function resolveFinalUrl(inputUrl: string): Promise<string> {
  const url = String(inputUrl || '').trim();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        'User-Agent': 'MyFNG/1.0 (gmb-fetch)',
        Accept: 'text/html,application/xhtml+xml,*/*',
      },
    });
    return String((res as any).url || url);
  } catch {
    return url;
  } finally {
    clearTimeout(timeout);
  }
}

async function findPlaceId(query: string): Promise<string | null> {
  if (!GOOGLE_API_KEY) return null;
  const cleanQuery = String(query || '').trim();
  if (!cleanQuery) return null;

  // 1) Find Place From Text
  const findUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(
    cleanQuery
  )}&inputtype=textquery&fields=place_id&key=${encodeURIComponent(GOOGLE_API_KEY)}`;

  const findRes = await fetch(findUrl, { cache: 'no-store' });
  const findJson: any = await findRes.json().catch(() => ({}));
  const candidates = Array.isArray(findJson?.candidates) ? findJson.candidates : [];
  if (candidates[0]?.place_id) return candidates[0].place_id;

  // 2) Text Search fallback (works better for many business names)
  const textSearchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
    cleanQuery
  )}&key=${encodeURIComponent(GOOGLE_API_KEY)}`;
  const textRes = await fetch(textSearchUrl, { cache: 'no-store' });
  const textJson: any = await textRes.json().catch(() => ({}));
  const results = Array.isArray(textJson?.results) ? textJson.results : [];
  return results[0]?.place_id || null;
}

function extractLatLngFromUrl(raw: string): { lat: number; lng: number } | null {
  const s = String(raw || '').trim();
  if (!s) return null;

  const at = s.match(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
  if (at?.[1] && at?.[2]) {
    const lat = Number(at[1]);
    const lng = Number(at[2]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }

  const d3d4d = s.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (d3d4d?.[1] && d3d4d?.[2]) {
    const lat = Number(d3d4d[1]);
    const lng = Number(d3d4d[2]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }

  return null;
}

async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  if (!GOOGLE_API_KEY) return null;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${encodeURIComponent(
    `${lat},${lng}`
  )}&key=${encodeURIComponent(GOOGLE_API_KEY)}`;
  const res = await fetch(url, { cache: 'no-store' });
  const json: any = await res.json().catch(() => ({}));
  const results = Array.isArray(json?.results) ? json.results : [];
  return results[0]?.formatted_address || null;
}

async function nearbyPlaceId(lat: number, lng: number): Promise<string | null> {
  if (!GOOGLE_API_KEY) return null;
  const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${encodeURIComponent(
    `${lat},${lng}`
  )}&radius=80&key=${encodeURIComponent(GOOGLE_API_KEY)}`;
  const res = await fetch(url, { cache: 'no-store' });
  const json: any = await res.json().catch(() => ({}));
  const results = Array.isArray(json?.results) ? json.results : [];
  return results[0]?.place_id || null;
}

async function fetchPlaceDetails(placeId: string) {
  if (!GOOGLE_API_KEY) throw new Error('GOOGLE_MAPS_API_KEY not configured');

  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(
    placeId
  )}&fields=${PLACE_DETAILS_FIELDS}&key=${encodeURIComponent(GOOGLE_API_KEY)}`;

  const res = await fetch(url, { cache: 'no-store' });
  const json: any = await res.json().catch(() => ({}));

  if (json?.status !== 'OK' || !json?.result) {
    throw new Error(`Place Details API failed: ${json?.status || 'UNKNOWN'}`);
  }

  const r = json.result;
  const reviews = Array.isArray(r.reviews)
    ? r.reviews.slice(0, 5).map((rev: any) => ({
        author_name: rev.author_name || '',
        author_photo: rev.profile_photo_url || '',
        rating: rev.rating || 0,
        text: rev.text || '',
        time: rev.time || 0,
        relative_time: rev.relative_time_description || '',
      }))
    : [];

  const openingHours = r.opening_hours?.weekday_text || [];

  const photos = Array.isArray(r.photos)
    ? r.photos.slice(0, 10).map((p: any) => ({
        photo_reference: p.photo_reference || '',
        width: p.width || 0,
        height: p.height || 0,
      }))
    : [];

  return {
    place_id: r.place_id || placeId,
    business_name: r.name || '',
    formatted_address: r.formatted_address || '',
    rating: r.rating || null,
    total_reviews: r.user_ratings_total || 0,
    reviews,
    opening_hours: openingHours,
    phone_number: r.formatted_phone_number || '',
    international_phone: r.international_phone_number || '',
    website: r.website || '',
    google_maps_uri: r.url || '',
    photos,
  };
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClientFromRequest(request);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userProfile = await resolveUserProfile(supabase as any, user as any);
    const roleCode = String((userProfile?.roles as any)?.role_code || '');
    const allowed = new Set(['SUPER_ADMIN', 'SUB_ADMIN', 'WORKSHOP_ADMIN']);
    if (!allowed.has(roleCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const googleMapsUrl = String(body?.google_maps_url || '').trim();
    let placeId = String(body?.place_id || '').trim() || null;
    const workshopId = String(body?.workshop_id || '').trim() || null;
    const gmbLocationName = String(body?.gmb_location_name || '').trim() || null;
    const prefetchedLocation = body?.prefetched_location || null;
    const workshopContext = body?.workshop_context || null;
    const attempts: string[] = [];

    console.log(`[GMB fetch] requested location: ${gmbLocationName || 'none'}, url: ${googleMapsUrl || 'none'}`);

    // ── Path A: GBP OAuth (preferred — no Places API billing needed) ──────────
    // If no location name was passed, try to resolve one from the GBP account directly
    // (handles the case where frontend state hasn't loaded locations yet)
    const accessToken = await getGbpAccessToken();
    let resolvedGbpLocationName = gmbLocationName;

    if (!resolvedGbpLocationName && accessToken) {
      try {
        const locRes = await fetch(
          'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
          { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' }, cache: 'no-store' }
        );
        const locJson: any = await locRes.json().catch(() => ({}));
        const accounts: any[] = Array.isArray(locJson?.accounts) ? locJson.accounts : [];
        outer: for (const acc of accounts) {
          const accountName = String(acc?.name || '').trim();
          if (!accountName) continue;
          const lUrl = new URL(`https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations`);
          lUrl.searchParams.set('readMask', 'name,metadata');
          lUrl.searchParams.set('pageSize', '20');
          const lRes = await fetch(lUrl.toString(), {
            headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
            cache: 'no-store',
          });
          const lJson: any = await lRes.json().catch(() => ({}));
          const locs: any[] = Array.isArray(lJson?.locations) ? lJson.locations : [];
          if (locs.length > 0) {
            // Prefer a location whose place_id matches the one extracted from the URL
            const urlPlaceId = placeId || (googleMapsUrl ? extractPlaceIdFromUrl(googleMapsUrl) : null);
            const matched = urlPlaceId
              ? locs.find((l: any) => String(l?.metadata?.placeId || '') === urlPlaceId)
              : null;
            const rawName = String((matched || locs[0])?.name || '');
            // Ensure full resource name (accounts/{id}/locations/{id})
            resolvedGbpLocationName = rawName.startsWith('accounts/')
              ? rawName
              : rawName ? `${accountName}/${rawName}` : '';
            if (resolvedGbpLocationName) break outer;
          }
        }
        if (resolvedGbpLocationName) {
          console.log(`[GMB fetch] auto-resolved location: ${resolvedGbpLocationName}`);
          attempts.push(`gbp_location_auto_resolved:${resolvedGbpLocationName}`);
        } else {
          attempts.push('gbp_location_auto_resolve:no_locations');
        }
      } catch (e: any) {
        attempts.push(`gbp_location_auto_resolve:failed(${e?.message || 'unknown'})`);
      }
    }

    if (resolvedGbpLocationName && accessToken) {
      try {
        console.log(`[GMB fetch] fetching via GBP OAuth for location: ${resolvedGbpLocationName}`);
        const gmbData = await fetchFullGbpLocation(resolvedGbpLocationName, accessToken, prefetchedLocation || undefined);
        if (workshopId) {
          await (supabase as any)
            .from('workshop_public_pages')
            .update({
              gmb_place_id: gmbData.place_id || null,
              gmb_data: { ...gmbData, gmb_location_name: resolvedGbpLocationName },
              gmb_last_fetched_at: new Date().toISOString(),
              gmb_location_name: resolvedGbpLocationName,
            })
            .eq('workshop_id', workshopId);
        }
        return NextResponse.json({ success: true, place_id: gmbData.place_id, data: gmbData, source: 'gbp' });
      } catch (gbpErr: any) {
        console.warn('GBP details fetch failed, falling back to Places API:', gbpErr?.message);
        attempts.push(`gbp_api:failed(${gbpErr?.message || 'unknown'})`);
      }
    } else if (!accessToken) {
      attempts.push('gbp_access_token:unavailable');
    }

    // ── Path B: Google Places API (fallback) ──────────────────────────────────
    if (!GOOGLE_API_KEY) {
      return NextResponse.json(
        { error: 'Google Business location not found and Google Maps API key is not configured. Please select a GMB location from the dropdown.' },
        { status: 500 }
      );
    }

    if (!googleMapsUrl && !placeId) {
      return NextResponse.json(
        { error: 'google_maps_url or place_id is required' },
        { status: 400 }
      );
    }

    // Step 1: Resolve shortened URLs
    let resolvedUrl = googleMapsUrl;
    if (googleMapsUrl && (googleMapsUrl.includes('goo.gl') || googleMapsUrl.includes('maps.app'))) {
      resolvedUrl = await resolveFinalUrl(googleMapsUrl);
    }

    // Step 2: Extract or find place_id
    if (!placeId && resolvedUrl) {
      placeId = extractPlaceIdFromUrl(resolvedUrl);
      attempts.push(placeId ? 'extractPlaceIdFromUrl:success' : 'extractPlaceIdFromUrl:failed');
    }

    if (!placeId && resolvedUrl) {
      const placeName = extractPlaceNameFromUrl(resolvedUrl);
      if (placeName) {
        placeId = await findPlaceId(placeName);
        attempts.push(placeId ? `findPlaceId(placeName):success` : `findPlaceId(placeName):failed`);
      } else {
        attempts.push('extractPlaceNameFromUrl:failed');
      }
    }

    // Fallback: use lat/lng from URL -> nearbysearch / reverse geocode + findplace
    if (!placeId && resolvedUrl) {
      const latLng = extractLatLngFromUrl(resolvedUrl);
      if (latLng) {
        const nearbyPid = await nearbyPlaceId(latLng.lat, latLng.lng);
        if (nearbyPid) {
          placeId = nearbyPid;
          attempts.push('nearbyPlaceId(latlng):success');
        } else {
          attempts.push('nearbyPlaceId(latlng):failed');
          const address = await reverseGeocode(latLng.lat, latLng.lng);
          if (address) {
            placeId = await findPlaceId(address);
            attempts.push(placeId ? 'findPlaceId(reverseGeocode):success' : 'findPlaceId(reverseGeocode):failed');
          } else {
            attempts.push('reverseGeocode:failed');
          }
        }
      } else {
        attempts.push('extractLatLngFromUrl:failed');
      }
    }

    // Fallback: search using workshop name if provided
    if (!placeId && workshopContext) {
      const q1 = `${workshopContext?.name || ''} ${workshopContext?.city || ''}`.trim();
      const q2 = `${workshopContext?.name || ''} ${workshopContext?.address || ''} ${workshopContext?.city || ''} ${workshopContext?.state || ''}`.trim();
      if (q1) {
        placeId = await findPlaceId(q1);
        attempts.push(placeId ? 'findPlaceId(workshopContext:q1):success' : 'findPlaceId(workshopContext:q1):failed');
      }
      if (!placeId && q2) {
        placeId = await findPlaceId(q2);
        attempts.push(placeId ? 'findPlaceId(workshopContext:q2):success' : 'findPlaceId(workshopContext:q2):failed');
      }
    }

    // Fallback: search using workshop name from DB
    if (!placeId && workshopId) {
      const { data: ws } = await supabase
        .from('workshops')
        .select('name, address, city, state')
        .eq('id', workshopId)
        .single() as { data: any };

      if (ws) {
        const searchQuery = `${ws.name} ${ws.address || ''} ${ws.city || ''} ${ws.state || ''}`.trim();
        placeId = await findPlaceId(searchQuery);
        attempts.push(placeId ? 'findPlaceId(workshop):success' : 'findPlaceId(workshop):failed');
      } else {
        attempts.push('workshopLookup:failed');
      }
    }

    if (!placeId) {
      return NextResponse.json(
        {
          error: 'Could not determine Place ID from the provided URL. Please use a business Google Maps share link (maps.app.goo.gl or google.com/maps/place/...).',
          debug: { resolved_url: resolvedUrl || null, attempts },
        },
        { status: 400 }
      );
    }

    // Step 3: Fetch Place Details via Places API
    const gmbData = await fetchPlaceDetails(placeId);

    // Step 4: Optionally store to DB
    if (workshopId) {
      const { error: updateError } = await (supabase as any)
        .from('workshop_public_pages')
        .update({
          gmb_place_id: gmbData.place_id,
          gmb_data: {
            ...gmbData,
            ...(gmbLocationName ? { gmb_location_name: gmbLocationName } : {}),
          },
          gmb_last_fetched_at: new Date().toISOString(),
          ...(gmbLocationName ? { gmb_location_name: gmbLocationName } : {}),
        })
        .eq('workshop_id', workshopId);

      if (updateError) {
        console.error('Failed to store GMB data:', updateError);
      }
    }

    return NextResponse.json({
      success: true,
      place_id: gmbData.place_id,
      data: gmbData,
      source: 'places',
    });
  } catch (e: any) {
    console.error('GMB fetch error:', e);
    return NextResponse.json(
      { error: 'Failed to fetch GMB data', details: e?.message },
      { status: 500 }
    );
  }
}
