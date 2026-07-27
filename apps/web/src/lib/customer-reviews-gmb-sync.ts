import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { fetchGbpReviews, fetchPlacesApiReviews } from '@/lib/gbp/parseLocation';
import {
  getGbpAccessTokenDetailed,
  readSystemSetting,
  upsertSystemSetting,
} from '@/lib/gbp/oauth';
import type { CustomerReviewScreen } from '@/lib/customer-reviews-admin';
import type { GmbReview } from '@/components/workshop/types';

const GOOGLE_API_KEY =
  process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

export type SyncCustomerReviewsFromGmbOptions = {
  screen?: CustomerReviewScreen | 'both';
  minStars?: number;
  locationName?: string | null;
  placeId?: string | null;
};

export type SyncCustomerReviewsFromGmbResult = {
  success: boolean;
  source: 'gbp' | 'places' | 'workshop_cache' | 'none';
  location_name: string | null;
  place_id: string | null;
  oauth_connected: boolean;
  maps_key_present: boolean;
  fetched: number;
  eligible: number;
  inserted: number;
  updated: number;
  skipped: number;
  screens: CustomerReviewScreen[];
  message: string;
  error?: string;
  debug?: string[];
};

type GbpLoc = { resource_name: string; place_id: string; title: string };

function formatReviewDate(unixSec: number): string {
  if (!unixSec) {
    return new Date().toLocaleString('en-IN', { month: 'short', year: 'numeric' });
  }
  return new Date(unixSec * 1000).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function stableExternalId(review: GmbReview, locationKey: string): string {
  if (review.review_id) return review.review_id;
  const base = [
    locationKey,
    review.author_name || 'anon',
    String(review.time || 0),
    String(review.rating || 0),
    String(review.text || '').slice(0, 80),
  ].join('|');
  return `gmb:${Buffer.from(base).toString('base64url').slice(0, 180)}`;
}

function normalizeLocationResource(accountName: string, rawName: string): string {
  const name = String(rawName || '').trim();
  if (!name) return '';
  if (name.startsWith('accounts/')) return name;
  if (name.startsWith('locations/')) return `${accountName}/${name}`;
  return `${accountName}/locations/${name}`;
}

async function listGbpLocations(accessToken: string): Promise<GbpLoc[]> {
  const authHeaders = {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/json',
  };
  const accountsRes = await fetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', {
    headers: authHeaders,
    cache: 'no-store',
  });
  const accountsJson: any = await accountsRes.json().catch(() => ({}));
  if (!accountsRes.ok) {
    throw new Error(
      String(accountsJson?.error?.message || `accounts_list_${accountsRes.status}`),
    );
  }

  const accounts: any[] = Array.isArray(accountsJson?.accounts) ? accountsJson.accounts : [];
  const out: GbpLoc[] = [];

  for (const acc of accounts) {
    const accountName = String(acc?.name || '').trim();
    if (!accountName) continue;
    const locUrl = new URL(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations`,
    );
    locUrl.searchParams.set('readMask', 'name,title,metadata');
    locUrl.searchParams.set('pageSize', '100');
    const locRes = await fetch(locUrl.toString(), { headers: authHeaders, cache: 'no-store' });
    const locJson: any = await locRes.json().catch(() => ({}));
    if (!locRes.ok) continue;
    for (const loc of Array.isArray(locJson?.locations) ? locJson.locations : []) {
      const resource_name = normalizeLocationResource(accountName, String(loc?.name || ''));
      if (!resource_name) continue;
      out.push({
        resource_name,
        place_id: String(loc?.metadata?.placeId || ''),
        title: String(loc?.title || ''),
      });
    }
  }
  return out;
}

function mapCachedReview(rev: any): GmbReview | null {
  const text = String(rev?.text || rev?.comment || '').trim();
  const rating = Number(rev?.rating || 0);
  if (!text || !rating) return null;
  return {
    author_name: String(rev?.author_name || rev?.reviewer?.displayName || 'Google reviewer'),
    author_photo: String(rev?.author_photo || rev?.reviewer?.profilePhotoUrl || ''),
    rating,
    text,
    time: Number(rev?.time || 0) || 0,
    relative_time: String(rev?.relative_time || ''),
    review_id: String(rev?.review_id || rev?.name || '').trim() || undefined,
  };
}

async function fetchReviewsFromWorkshopCache(admin: any): Promise<GmbReview[]> {
  const { data, error } = await admin
    .from('workshop_public_pages')
    .select('gmb_data')
    .not('gmb_data', 'is', null)
    .limit(30);
  if (error) {
    console.warn('[customer-reviews-gmb] workshop cache', error.message);
    return [];
  }

  const out: GmbReview[] = [];
  const seen = new Set<string>();
  for (const row of data || []) {
    const reviews = Array.isArray(row?.gmb_data?.reviews) ? row.gmb_data.reviews : [];
    for (const rev of reviews) {
      const mapped = mapCachedReview(rev);
      if (!mapped) continue;
      const key = `${mapped.author_name}|${mapped.time}|${mapped.text.slice(0, 40)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(mapped);
    }
  }
  return out;
}

export async function syncCustomerReviewsFromGmb(
  options: SyncCustomerReviewsFromGmbOptions = {},
): Promise<SyncCustomerReviewsFromGmbResult> {
  const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
  const mapsKeyPresent = Boolean(GOOGLE_API_KEY);

  const fail = (
    message: string,
    extra: Partial<SyncCustomerReviewsFromGmbResult> = {},
  ): SyncCustomerReviewsFromGmbResult => ({
    success: false,
    source: 'none',
    location_name: null,
    place_id: null,
    oauth_connected: false,
    maps_key_present: mapsKeyPresent,
    fetched: 0,
    eligible: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    screens: [],
    message,
    error: extra.error || message,
    ...extra,
  });

  if (!supabaseAdmin) {
    return fail(adminError || 'Admin client not configured');
  }

  const minStars = Math.min(5, Math.max(1, Number(options.minStars) || 4));
  const screenOpt = String(options.screen || 'both').toLowerCase();
  const screens: CustomerReviewScreen[] =
    screenOpt === 'rsa' ? ['rsa'] : screenOpt === 'home' ? ['home'] : ['home', 'rsa'];

  const auth = await getGbpAccessTokenDetailed();
  const accessToken = auth.accessToken;
  const oauthConnected = Boolean(auth.hasRefreshToken);
  const debug: string[] = [];
  if (auth.reason) debug.push(`auth:${auth.reason}`);

  let locationName = String(options.locationName || '').trim()
    || (await readSystemSetting(supabaseAdmin, 'customer_reviews_gmb_location_name'))
    || String(process.env.CUSTOMER_REVIEWS_GMB_LOCATION || '').trim();

  let placeId = String(options.placeId || '').trim()
    || (await readSystemSetting(supabaseAdmin, 'customer_reviews_gmb_place_id'))
    || String(process.env.CUSTOMER_REVIEWS_GMB_PLACE_ID || '').trim();

  if (!locationName || !placeId) {
    const { data: workshop } = await supabaseAdmin
      .from('workshop_public_pages')
      .select('gmb_location_name, gmb_place_id')
      .or('gmb_location_name.not.is.null,gmb_place_id.not.is.null')
      .limit(1)
      .maybeSingle();
    if (!locationName) locationName = String(workshop?.gmb_location_name || '').trim();
    if (!placeId) placeId = String(workshop?.gmb_place_id || '').trim();
  }

  let reviews: GmbReview[] = [];
  let source: SyncCustomerReviewsFromGmbResult['source'] = 'none';

  // 1) GBP OAuth — try preferred location, then all account locations
  if (accessToken) {
    const candidates: GbpLoc[] = [];
    if (locationName) {
      candidates.push({ resource_name: locationName, place_id: placeId, title: 'preferred' });
    }
    try {
      const listed = await listGbpLocations(accessToken);
      debug.push(`gbp_locations:${listed.length}`);
      for (const loc of listed) {
        if (!candidates.some((c) => c.resource_name === loc.resource_name)) {
          candidates.push(loc);
        }
        if (!placeId && loc.place_id) placeId = loc.place_id;
        if (!locationName && loc.resource_name) locationName = loc.resource_name;
      }
    } catch (e: any) {
      debug.push(`gbp_locations_error:${e?.message || 'failed'}`);
    }

    for (const loc of candidates.slice(0, 8)) {
      debug.push(`gbp_try:${loc.resource_name}`);
      const result = await fetchGbpReviews(loc.resource_name, {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      });
      debug.push(`gbp_count:${result.reviews.length}`);
      if (result.reviews.length > 0) {
        reviews = result.reviews;
        source = 'gbp';
        locationName = loc.resource_name;
        if (loc.place_id) placeId = loc.place_id;
        break;
      }
    }
  } else if (oauthConnected) {
    debug.push('oauth_refresh_token_present_but_no_access_token');
  } else {
    debug.push('oauth_not_connected');
  }

  // 2) Places API fallback
  if (!reviews.length && placeId && GOOGLE_API_KEY) {
    debug.push(`places_try:${placeId}`);
    const result = await fetchPlacesApiReviews(placeId, GOOGLE_API_KEY);
    debug.push(`places_count:${result.reviews.length}`);
    if (result.reviews.length > 0) {
      reviews = result.reviews;
      source = 'places';
    }
  } else if (!reviews.length) {
    debug.push(!placeId ? 'places_skip:no_place_id' : 'places_skip:no_maps_key');
  }

  // 3) Workshop cached gmb_data
  if (!reviews.length) {
    const cached = await fetchReviewsFromWorkshopCache(supabaseAdmin);
    debug.push(`workshop_cache_count:${cached.length}`);
    if (cached.length > 0) {
      reviews = cached;
      source = 'workshop_cache';
    }
  }

  if (!reviews.length) {
    let message =
      'Reviews fetch nahi ho paayi.';
    if (!oauthConnected) {
      message +=
        ' Google Business connect karo: Workshops → Public Pages → Connect Google Business.';
    } else if (!accessToken) {
      message +=
        ' Google connected dikhta hai lekin access token refresh fail. Dubara Connect Google Business karo.';
    } else if (!locationName && !placeId) {
      message +=
        ' Location nahi mili. Workshops → Public Pages pe GMB location select/fetch karo.';
    } else {
      message +=
        ' Location mila lekin Google reviews API empty/failed. Workshops pe ek baar GMB Fetch chalao, ya Maps API key (Places Details) enable karo.';
    }

    return fail(message, {
      source,
      location_name: locationName || null,
      place_id: placeId || null,
      oauth_connected: oauthConnected,
      screens,
      error: 'no_reviews',
      debug,
    });
  }

  const eligible = reviews.filter(
    (r) => Number(r.rating) >= minStars && String(r.text || '').trim().length > 0,
  );

  if (!eligible.length) {
    return fail(`${reviews.length} review(s) mili, lekin koi ≥${minStars}★ text review nahi thi.`, {
      source,
      location_name: locationName || null,
      place_id: placeId || null,
      oauth_connected: oauthConnected,
      fetched: reviews.length,
      screens,
      error: 'no_eligible',
      debug,
    });
  }

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const locationKey = locationName || placeId || 'unknown';

  const { data: maxOrderRow } = await supabaseAdmin
    .from('customer_reviews')
    .select('display_order')
    .order('display_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  let nextOrder = Number(maxOrderRow?.display_order || 0) + 1;

  for (const review of eligible) {
    const externalId = stableExternalId(review, locationKey);
    const name = String(review.author_name || 'Google reviewer').trim() || 'Google reviewer';
    const text = String(review.text || '').trim();
    const date = formatReviewDate(Number(review.time || 0));
    const stars = Math.min(5, Math.max(1, Number(review.rating) || 5));

    for (const screen of screens) {
      const { data: existing } = await supabaseAdmin
        .from('customer_reviews')
        .select('id')
        .eq('screen', screen)
        .eq('external_id', externalId)
        .maybeSingle();

      if (existing?.id) {
        const { error } = await supabaseAdmin
          .from('customer_reviews')
          .update({
            name,
            text,
            stars,
            date,
            source: 'gmb',
            source_location: locationKey,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
        if (error) skipped += 1;
        else updated += 1;
        continue;
      }

      const { error } = await supabaseAdmin.from('customer_reviews').insert({
        name,
        car: 'Google review',
        stars,
        text,
        date,
        display_order: nextOrder++,
        is_active: true,
        screen,
        source: 'gmb',
        external_id: externalId,
        source_location: locationKey,
      });
      if (error) skipped += 1;
      else inserted += 1;
    }
  }

  if (locationName) {
    await upsertSystemSetting(
      supabaseAdmin,
      'customer_reviews_gmb_location_name',
      locationName,
      'GBP location for Customer Reviews sync',
    );
  }
  if (placeId) {
    await upsertSystemSetting(
      supabaseAdmin,
      'customer_reviews_gmb_place_id',
      placeId,
      'Google Place ID fallback for Customer Reviews sync',
    );
  }
  await upsertSystemSetting(
    supabaseAdmin,
    'customer_reviews_gmb_last_sync_at',
    new Date().toISOString(),
    'Last Customer Reviews GMB sync time',
  );

  return {
    success: true,
    source,
    location_name: locationName || null,
    place_id: placeId || null,
    oauth_connected: oauthConnected,
    maps_key_present: mapsKeyPresent,
    fetched: reviews.length,
    eligible: eligible.length,
    inserted,
    updated,
    skipped,
    screens,
    message: `Synced ${eligible.length} review(s) ≥${minStars}★ via ${source}: ${inserted} new, ${updated} updated.`,
    debug,
  };
}
