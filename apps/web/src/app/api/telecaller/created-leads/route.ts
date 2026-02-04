import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClientFromRequest(request);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userProfile = await resolveUserProfile(supabase as any, user as any);
    const roleCode = (userProfile?.roles as any)?.role_code || null;
    if (roleCode !== 'TELECALLER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10) || 50, 1), 200);

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    const db = (supabaseAdmin ?? supabase) as any;
    if (!supabaseAdmin && adminError) {
      // ok; may still work with RLS
      console.warn('Supabase admin client not configured:', adminError);
    }

    const { data: leads, error } = await db
      .from('service_leads')
      .select('id, lead_number, customer_name, customer_phone, vehicle_number, vehicle_make, vehicle_model, status, created_at')
      .eq('created_by_id', userProfile.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) return NextResponse.json({ error: 'Failed to fetch created leads', details: error.message }, { status: 500 });

    return NextResponse.json({ success: true, leads: leads || [] }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}

