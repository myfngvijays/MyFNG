import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export async function GET() {
  try {
    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) return NextResponse.json({ error: adminError }, { status: 500 });

    const { data, error } = await supabaseAdmin
      .from('app_settings_menu')
      .select('menu_id, label, icon, section, enabled, display_order, requires_login')
      .order('section')
      .order('display_order');

    if (error) throw error;

    return NextResponse.json({
      main: (data || []).filter((d: any) => d.section === 'main' && d.enabled),
      legal: (data || []).filter((d: any) => d.section === 'legal' && d.enabled),
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
