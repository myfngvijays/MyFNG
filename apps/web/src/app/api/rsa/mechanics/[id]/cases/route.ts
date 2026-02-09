import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * GET /api/rsa/mechanics/[id]/cases
 * Returns RSA leads assigned to this mechanic (RSA_MANAGER/SUPER_ADMIN/SUB_ADMIN).
 * Uses service role to avoid RLS mismatches between list vs detail.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const profile = await resolveUserProfile(supabase as any, user as any);
    const roleCode = String((profile?.roles as any)?.role_code || '');
    const allowed = new Set(['RSA_MANAGER', 'SUPER_ADMIN', 'SUB_ADMIN']);
    if (!allowed.has(roleCode)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Server configuration: SUPABASE_SERVICE_ROLE_KEY required', details: adminError ?? '' },
        { status: 503 }
      );
    }

    const { id } = await params;
    const mechanicId = String(id || '').trim();
    if (!mechanicId) return NextResponse.json({ error: 'Missing mechanic id' }, { status: 400 });

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '200', 10) || 200, 1), 500);

    const { data, error } = await (supabaseAdmin as any)
      .from('rsa_leads')
      .select(
        'id, customer_name, contact_number, vehicle_number, vehicle_model, service_type, lead_status, complaint_status, requested_at, lead_registered_at, mechanic_assigned_datetime, mechanic_started_datetime, mechanic_completed_datetime, mechanic_cancelled_datetime'
      )
      .eq('assigned_mechanic_id', mechanicId)
      .order('requested_at', { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch cases', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, leads: data || [] }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message ?? String(e) }, { status: 500 });
  }
}

