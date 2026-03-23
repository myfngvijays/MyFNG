/**
 * Shared GBP API parsing utilities — used by both /api/workshops/gmb/fetch and /api/workshops/gmb/sync
 */

import type {
  GmbData,
  GmbReview,
  GmbCategory,
  GmbServiceItem,
  GmbAttribute,
  GmbSpecialHour,
} from '@/components/workshop/types';

export const GBP_STAR_MAP: Record<string, number> = {
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
};

export const GBP_DAY_ORDER = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
] as const;

// Valid fields for mybusinessbusinessinformation.googleapis.com/v1/{name}
// Note: serviceItems and moreHours are NOT valid fields on this endpoint
export const GBP_READ_MASK = [
  'name',
  'title',
  'storefrontAddress',
  'phoneNumbers',
  'websiteUri',
  'regularHours',
  'specialHours',
  'metadata',
  'profile',
  'categories',
  'attributes',
  'latlng',
  'openInfo',
].join(',');

// Minimal readMask — used to test if the single-location GET itself works at all
export const GBP_READ_MASK_MINIMAL = 'name,title';

export function formatGbpTime(t: any): string {
  if (!t) return '00:00';
  return `${String(t?.hours ?? 0).padStart(2, '0')}:${String(t?.minutes ?? 0).padStart(2, '0')}`;
}

export function formatGbpAddress(loc: any): string {
  const addr = loc?.storefrontAddress || {};
  const lines = Array.isArray(addr?.addressLines) ? addr.addressLines : [];
  return [...lines, addr?.locality, addr?.administrativeArea, addr?.postalCode]
    .filter(Boolean)
    .join(', ');
}

export function parseOpeningHours(details: any): string[] {
  const periods: any[] = details?.regularHours?.periods || [];
  const dayHoursMap: Record<string, string> = {};
  for (const period of periods) {
    const day = String(period?.openDay || '').toUpperCase();
    if ((GBP_DAY_ORDER as readonly string[]).includes(day)) {
      dayHoursMap[day] = `${formatGbpTime(period?.openTime)} – ${formatGbpTime(period?.closeTime)}`;
    }
  }
  return GBP_DAY_ORDER.map((day) => {
    const label = day.charAt(0) + day.slice(1).toLowerCase();
    return `${label}: ${dayHoursMap[day] || 'Closed'}`;
  });
}

export function parseSpecialHours(details: any): GmbSpecialHour[] {
  const periods: any[] = details?.specialHours?.specialHourPeriods || [];
  return periods.map((p: any) => {
    const sd = p?.startDate || {};
    const date = `${String(sd.year || '').padStart(4, '0')}-${String(sd.month || '').padStart(2, '0')}-${String(sd.day || '').padStart(2, '0')}`;
    return {
      date,
      closed: Boolean(p?.closed),
      open_time: p?.openTime ? formatGbpTime(p.openTime) : undefined,
      close_time: p?.closeTime ? formatGbpTime(p.closeTime) : undefined,
    };
  });
}

export function parseCategories(details: any): {
  primary_category: GmbCategory | null;
  additional_categories: GmbCategory[];
} {
  const primary = details?.categories?.primaryCategory;
  const additional: any[] = details?.categories?.additionalCategories || [];
  return {
    primary_category: primary
      ? { name: String(primary.name || ''), display_name: String(primary.displayName || '') }
      : null,
    additional_categories: additional.map((c: any) => ({
      name: String(c.name || ''),
      display_name: String(c.displayName || ''),
    })),
  };
}

// serviceItems is not available on the Business Information API v1 endpoint.
// GBP service catalog requires a separate Services API call — not implemented here.
export function parseServiceItems(_details: any): GmbServiceItem[] {
  return [];
}

export function parseAttributes(details: any): GmbAttribute[] {
  const attrs: any[] = details?.attributes || [];
  return attrs.map((a: any) => ({
    name: String(a?.name || ''),
    display_name: String(a?.attributeMetadata?.displayName || a?.name || ''),
    values: Array.isArray(a?.values) ? a.values : [],
  }));
}

export function parseReviews(reviewsJson: any): GmbReview[] {
  const raw: any[] = Array.isArray(reviewsJson?.reviews) ? reviewsJson.reviews : [];
  return raw.slice(0, 10).map((rev: any) => ({
    author_name: String(rev?.reviewer?.displayName || ''),
    author_photo: String(rev?.reviewer?.profilePhotoUrl || ''),
    rating: GBP_STAR_MAP[String(rev?.starRating || '')] ?? 0,
    text: String(rev?.comment || ''),
    time: rev?.createTime ? Math.floor(new Date(rev.createTime).getTime() / 1000) : 0,
    relative_time: String(rev?.relativePublishTimeDescription || ''),
    reply: rev?.reviewReply?.comment ? String(rev.reviewReply.comment) : undefined,
  }));
}

export function calcAverageRating(reviewsJson: any, reviews: GmbReview[]): number | null {
  if (reviewsJson?.averageRating != null) return Number(reviewsJson.averageRating);
  if (reviews.length > 0) {
    const sum = reviews.reduce((s, r) => s + r.rating, 0);
    return Math.round((sum / reviews.length) * 10) / 10;
  }
  return null;
}

/**
 * Fetch reviews — tries GBP v4 first, then newer mybusinessreviews API as fallback.
 */
export async function fetchGbpReviews(
  resourceName: string,
  authHeaders: Record<string, string>
): Promise<{ reviews: GmbReview[]; averageRating: number | null; totalReviewCount: number }> {
  const endpoints = [
    `https://mybusiness.googleapis.com/v4/${resourceName}/reviews?pageSize=50&orderBy=updateTime+desc`,
    `https://mybusinessreviews.googleapis.com/v1/${resourceName}/reviews?pageSize=50`,
  ];

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, { headers: authHeaders, cache: 'no-store' });
      const json: any = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errMsg = String(json?.error?.message || json?.error?.status || 'unknown');
        if (res.status === 403 && errMsg.toLowerCase().includes('has not been used')) {
          console.warn(`[GBP reviews] API not enabled — enable "Google My Business API" at https://console.developers.google.com/apis/api/mybusiness.googleapis.com/overview?project=${json?.error?.details?.[0]?.metadata?.consumer?.replace('projects/', '') || 'YOUR_PROJECT_ID'}`);
        } else {
          console.warn(`[GBP reviews] ${endpoint} → ${res.status}: ${errMsg}`);
        }
        continue;
      }
      const reviews = parseReviews(json);
      console.log(`[GBP reviews] ${endpoint} → ok, count=${reviews.length}, avg=${json?.averageRating}`);
      return {
        reviews,
        averageRating: calcAverageRating(json, reviews),
        totalReviewCount: json?.totalReviewCount != null ? Number(json.totalReviewCount) : reviews.length,
      };
    } catch (e: any) {
      console.warn(`[GBP reviews] ${endpoint} threw: ${e?.message}`);
    }
  }

  return { reviews: [], averageRating: null, totalReviewCount: 0 };
}

/**
 * Parse full location details API response into GmbData shape.
 */
export function parseLocationDetails(
  details: any,
  reviewsResult: { reviews: GmbReview[]; averageRating: number | null; totalReviewCount: number },
  resourceName: string
): GmbData {
  const { primary_category, additional_categories } = parseCategories(details);
  const latlngRaw = details?.latlng;
  const latlng =
    latlngRaw?.latitude != null && latlngRaw?.longitude != null
      ? { lat: Number(latlngRaw.latitude), lng: Number(latlngRaw.longitude) }
      : null;

  return {
    place_id: String(details?.metadata?.placeId || ''),
    gmb_location_name: resourceName,
    business_name: String(details?.title || ''),
    description: String(details?.profile?.description || ''),
    formatted_address: formatGbpAddress(details),
    latlng,
    phone_number: String(details?.phoneNumbers?.primaryPhone || ''),
    international_phone: String(details?.phoneNumbers?.primaryPhone || ''),
    website: String(details?.websiteUri || ''),
    google_maps_uri: String(details?.metadata?.mapsUri || ''),
    rating: reviewsResult.averageRating,
    total_reviews: reviewsResult.totalReviewCount,
    reviews: reviewsResult.reviews,
    opening_hours: parseOpeningHours(details),
    special_hours: parseSpecialHours(details),
    open_status: String(details?.openInfo?.status || ''),
    primary_category,
    additional_categories,
    service_items: parseServiceItems(details),
    attributes: parseAttributes(details),
    photos: [],
  };
}

/**
 * Fetch full GBP location details + reviews, return unified GmbData.
 *
 * STRATEGY: The Business Information API single-location GET may return 404
 * when the API is not enabled for the project. Instead, we accept pre-fetched
 * location data (already available from the listing call) and only call the
 * reviews API which is a separate endpoint.
 *
 * @param prefetchedDetails - location data already loaded from the listing API
 */
export async function fetchFullGbpLocation(
  resourceName: string,
  accessToken: string,
  prefetchedDetails?: Record<string, any>
): Promise<GmbData> {
  const authHeaders = {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/json',
  };

  let details: any = prefetchedDetails || null;

  // GBP listing returns name as "locations/{id}" (no accounts/ prefix).
  // Single GET must use that path directly: v1/locations/{id}
  // Fallback: also try v1/accounts/{accountId}/locations/{id} if the first fails.
  const locationIdPath = resourceName.includes('/locations/')
    ? `locations/${resourceName.split('/locations/')[1]}`
    : resourceName;

  const tryGet = async (path: string): Promise<{ ok: boolean; data: any; status: number }> => {
    const url = new URL(`https://mybusinessbusinessinformation.googleapis.com/v1/${path}`);
    url.searchParams.set('readMask', GBP_READ_MASK);
    const res = await fetch(url.toString(), { headers: authHeaders, cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    console.log(`[GBP details] GET ${path} → ${res.status}: ${res.ok ? `title=${data?.title}` : JSON.stringify(data?.error?.message || data).slice(0, 120)}`);
    return { ok: res.ok, data, status: res.status };
  };

  try {
    // Try v1/locations/{id} first (the name as returned by the listing API)
    let result = await tryGet(locationIdPath);

    // Fallback: try the full accounts/{id}/locations/{id} path
    if (!result.ok && locationIdPath !== resourceName) {
      result = await tryGet(resourceName);
    }

    if (result.ok) {
      details = result.data;
    } else {
      const errMsg = result.data?.error?.message || result.status;
      console.warn(`[GBP details] GET failed (${result.status}) — using pre-fetched fallback`);
      if (!details) {
        throw new Error(`GBP location details failed: ${errMsg}`);
      }
    }
  } catch (e: any) {
    if (!details) throw e;
    console.warn(`[GBP details] fetch threw: ${e?.message} — using pre-fetched fallback`);
  }

  const reviewsResult = await fetchGbpReviews(resourceName, authHeaders);
  return parseLocationDetails(details, reviewsResult, resourceName);
}
