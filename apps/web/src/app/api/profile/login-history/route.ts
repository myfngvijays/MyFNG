import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { count, error: countError } = await supabase
      .from('user_login_history')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if (countError) {
      return NextResponse.json(
        { error: countError.message, total: 0, recent: [] },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from('user_login_history')
      .select(
        'id, logged_in_at, platform, user_agent, created_at, ip_address, location_label, city, device_label, latitude, longitude',
      )
      .eq('user_id', user.id)
      .order('logged_in_at', { ascending: false })
      .limit(50);

    if (error) {
      // Older DB without geo columns
      if (/column|ip_address|location_label|device_label/i.test(error.message || '')) {
        const fallback = await supabase
          .from('user_login_history')
          .select('id, logged_in_at, platform, user_agent, created_at')
          .eq('user_id', user.id)
          .order('logged_in_at', { ascending: false })
          .limit(50);
        if (fallback.error) {
          return NextResponse.json(
            { error: fallback.error.message, total: 0, recent: [] },
            { status: 400 },
          );
        }
        return NextResponse.json({
          success: true,
          total: count ?? fallback.data?.length ?? 0,
          recent: fallback.data || [],
        });
      }
      return NextResponse.json({ error: error.message, total: 0, recent: [] }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      total: count ?? data?.length ?? 0,
      recent: data || [],
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Failed to load login history', total: 0, recent: [] },
      { status: 500 },
    );
  }
}
