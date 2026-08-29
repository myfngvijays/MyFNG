import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { NextResponse } from 'next/server';

export const revalidate = 300;

const CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
};

export async function GET() {
  try {
    const { supabaseAdmin } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ data: [] }, { headers: CACHE_HEADERS });
    }

    const { data, error } = await supabaseAdmin
      .from('web_car_brand')
      .select('id, name, logo_url, display_order')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Error fetching public car brands:', error);
      return NextResponse.json({ data: [] }, { headers: CACHE_HEADERS });
    }

    return NextResponse.json({ data: data || [] }, { headers: CACHE_HEADERS });
  } catch {
    return NextResponse.json({ data: [] }, { headers: CACHE_HEADERS });
  }
}
