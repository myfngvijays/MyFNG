import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import {
  FOOTER_WORKSHOP_LOCATIONS,
  filterFooterLocationsByPublishedSlugs,
} from '@/lib/workshop/footer-locations';

export const revalidate = 300;

/**
 * GET /api/public/workshop-footer-locations
 * Footer location links filtered to published workshop public pages only.
 */
export async function GET() {
  try {
    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: adminError || 'Database not available', locations: [], popular: [] },
        { status: 500 },
      );
    }

    const slugs = FOOTER_WORKSHOP_LOCATIONS.map((loc) => loc.slug);
    const { data, error } = await supabaseAdmin
      .from('workshop_public_pages')
      .select('slug, workshop:workshops(is_active)')
      .eq('is_published', true)
      .in('slug', slugs);

    if (error) {
      return NextResponse.json(
        { error: error.message || 'Failed to load workshop pages', locations: [], popular: [] },
        { status: 500 },
      );
    }

    // Hide pages whose workshop is switched OFF in admin (those pages don't open).
    const result = filterFooterLocationsByPublishedSlugs(
      (data || [])
        .filter((row: any) => {
          const ws = Array.isArray(row.workshop) ? row.workshop[0] : row.workshop;
          return ws?.is_active !== false;
        })
        .map((row: any) => String(row.slug)),
    );
    return NextResponse.json(
      { success: true, ...result },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } },
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to load footer locations';
    return NextResponse.json({ error: message, locations: [], popular: [] }, { status: 500 });
  }
}
