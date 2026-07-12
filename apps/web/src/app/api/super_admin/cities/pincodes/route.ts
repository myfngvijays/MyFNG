import { NextRequest, NextResponse } from 'next/server';
import { getDbWithAdmin } from '@/app/api/whatsapp/bot-flow/utils';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export const dynamic = 'force-dynamic';

function normalizePincodeCsv(raw: unknown): string {
  const list = String(raw || '')
    .split(/[,\s|]+/)
    .map((item) => item.trim())
    .filter((item) => /^\d{6}$/.test(item));
  return Array.from(new Set(list)).join(',');
}

export async function GET() {
  try {
    const auth = await getDbWithAdmin();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { supabaseAdmin } = getSupabaseAdmin();
    if (!supabaseAdmin) return NextResponse.json({ error: 'Supabase admin unavailable' }, { status: 500 });

    const { data, error } = await supabaseAdmin
      .from('cities')
      .select('id, name, state, city_pincodes, is_active')
      .order('name');

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      success: true,
      cities: (data || []).map((city: any) => ({
        id: city.id,
        name: city.name,
        state: city.state,
        city_pincodes: city.city_pincodes || '',
        is_active: city.is_active,
      })),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await getDbWithAdmin();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await request.json().catch(() => ({}));
    const cityId = String(body?.city_id || '').trim();
    const cityPincodes = normalizePincodeCsv(body?.city_pincodes);

    if (!cityId) {
      return NextResponse.json({ error: 'city_id is required' }, { status: 400 });
    }

    const { supabaseAdmin } = getSupabaseAdmin();
    if (!supabaseAdmin) return NextResponse.json({ error: 'Supabase admin unavailable' }, { status: 500 });

    const { data, error } = await supabaseAdmin
      .from('cities')
      .update({ city_pincodes: cityPincodes || null })
      .eq('id', cityId)
      .select('id, name, state, city_pincodes, is_active')
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: 'City not found' }, { status: 404 });

    return NextResponse.json({ success: true, city: data });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
