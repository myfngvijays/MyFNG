import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { supabaseAdmin } = getSupabaseAdmin();

    const { data: row } = await supabaseAdmin
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'refer_and_rise_config')
      .maybeSingle();

    if (!row?.setting_value) {
      return NextResponse.json({ success: true, config: null });
    }

    const config = JSON.parse(row.setting_value);
    return NextResponse.json({ success: true, config });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to load config' }, { status: 500 });
  }
}
