import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { supabaseAdmin } = getSupabaseAdmin();
    if (!supabaseAdmin) return NextResponse.json({ popups: [] });

    const now = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('app_popups')
      .select('id, title, body, icon, image_url, primary_button_text, primary_button_action, secondary_button_text, target_screens, display_rule, show_for, priority')
      .eq('is_active', true)
      .or(`starts_at.is.null,starts_at.lte.${now}`)
      .or(`ends_at.is.null,ends_at.gte.${now}`)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) return NextResponse.json({ popups: [] });
    return NextResponse.json({ popups: data || [] });
  } catch {
    return NextResponse.json({ popups: [] });
  }
}
