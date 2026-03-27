import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

const GOOGLE_API_KEY =
  process.env.GOOGLE_MAPS_API_KEY ||
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
  '';

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

function assertCronAuth(req: NextRequest): string | null {
  const secret = process.env.CRON_SECRET || process.env.NOTIFICATION_CRON_SECRET;
  if (!secret) return 'CRON secret is not configured on server';
  const auth = req.headers.get('authorization') || '';
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  if (!token || token !== secret) return 'Unauthorized';
  return null;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPlaceDetails(placeId: string) {
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(
    placeId
  )}&fields=${PLACE_DETAILS_FIELDS}&key=${encodeURIComponent(GOOGLE_API_KEY)}`;

  const res = await fetch(url, { cache: 'no-store' });
  const json: any = await res.json().catch(() => ({}));

  if (json?.status !== 'OK' || !json?.result) return null;

  const r = json.result;
  const reviews = Array.isArray(r.reviews)
    ? r.reviews.map((rev: any) => ({
        author_name: rev.author_name || '',
        author_photo: rev.profile_photo_url || '',
        rating: rev.rating || 0,
        text: rev.text || '',
        time: rev.time || 0,
        relative_time: rev.relative_time_description || '',
      }))
    : [];

  return {
    place_id: r.place_id || placeId,
    business_name: r.name || '',
    formatted_address: r.formatted_address || '',
    rating: r.rating || null,
    total_reviews: r.user_ratings_total || 0,
    reviews,
    opening_hours: r.opening_hours?.weekday_text || [],
    phone_number: r.formatted_phone_number || '',
    international_phone: r.international_phone_number || '',
    website: r.website || '',
    google_maps_uri: r.url || '',
    photos: Array.isArray(r.photos)
      ? r.photos.slice(0, 10).map((p: any) => ({
          photo_reference: p.photo_reference || '',
          width: p.width || 0,
          height: p.height || 0,
        }))
      : [],
  };
}

export async function POST(request: NextRequest) {
  const authErr = assertCronAuth(request);
  if (authErr) {
    return NextResponse.json({ error: authErr }, { status: 401 });
  }

  if (!GOOGLE_API_KEY) {
    return NextResponse.json(
      { error: 'GOOGLE_MAPS_API_KEY not configured' },
      { status: 500 }
    );
  }

  const { supabaseAdmin, error: adminErr } = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: `Supabase admin init failed: ${adminErr}` },
      { status: 500 }
    );
  }

  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: stalePages, error: queryErr } = await supabaseAdmin
      .from('workshop_public_pages')
      .select('id, workshop_id, gmb_place_id, gmb_last_fetched_at')
      .not('gmb_place_id', 'is', null)
      .or(`gmb_last_fetched_at.is.null,gmb_last_fetched_at.lt.${twentyFourHoursAgo}`)
      .limit(50);

    if (queryErr) {
      return NextResponse.json(
        { error: 'Failed to query stale pages', details: queryErr.message },
        { status: 500 }
      );
    }

    if (!stalePages || stalePages.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No stale GMB data found',
        refreshed: 0,
      });
    }

    let refreshed = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const page of stalePages) {
      try {
        const gmbData = await fetchPlaceDetails(page.gmb_place_id!);
        if (!gmbData) {
          failed++;
          errors.push(`${page.id}: Place Details returned null`);
          continue;
        }

        const { error: updateErr } = await supabaseAdmin
          .from('workshop_public_pages')
          .update({
            gmb_data: gmbData,
            gmb_last_fetched_at: new Date().toISOString(),
          })
          .eq('id', page.id);

        if (updateErr) {
          failed++;
          errors.push(`${page.id}: ${updateErr.message}`);
        } else {
          refreshed++;
        }

        // Rate limit: 200ms between requests
        await sleep(200);
      } catch (err: any) {
        failed++;
        errors.push(`${page.id}: ${err?.message || 'unknown'}`);
      }
    }

    return NextResponse.json({
      success: true,
      total: stalePages.length,
      refreshed,
      failed,
      ...(errors.length > 0 ? { errors: errors.slice(0, 10) } : {}),
    });
  } catch (e: any) {
    console.error('GMB refresh cron error:', e);
    return NextResponse.json(
      { error: 'Internal error', details: e?.message },
      { status: 500 }
    );
  }
}
