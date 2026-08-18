import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export const dynamic = 'force-dynamic';

/**
 * POST /api/telecaller/crm/transfer
 * Peer transfer / soft-share a service lead to another telecaller.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClientFromRequest(request);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const profile = await resolveUserProfile(supabase, user);
    if (!profile?.id) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const leadId = String(body?.lead_id || '').trim();
    const toId = String(body?.to_telecaller_id || '').trim();
    const transferType = String(body?.transfer_type || 'TRANSFER').toUpperCase();
    const reason = String(body?.reason || '').trim() || null;

    if (!leadId || !toId) {
      return NextResponse.json({ error: 'lead_id and to_telecaller_id required' }, { status: 400 });
    }
    if (!['TRANSFER', 'SHARE', 'ESCALATE'].includes(transferType)) {
      return NextResponse.json({ error: 'Invalid transfer_type' }, { status: 400 });
    }
    if (toId === String(profile.id)) {
      return NextResponse.json({ error: 'Cannot transfer to yourself' }, { status: 400 });
    }

    const { supabaseAdmin } = getSupabaseAdmin();
    const db = (supabaseAdmin ?? supabase) as any;

    const { data: lead } = await db
      .from('service_leads')
      .select('id, assigned_telecaller_id, status')
      .eq('id', leadId)
      .maybeSingle();

    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

    if (transferType === 'TRANSFER' || transferType === 'ESCALATE') {
      const { error: updErr } = await db
        .from('service_leads')
        .update({
          assigned_telecaller_id: toId,
          updated_at: new Date().toISOString(),
          notes: reason
            ? `${lead.status || ''} | Transferred: ${reason}`.trim()
            : undefined,
        })
        .eq('id', leadId);
      if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 });
    }

    const { data: transfer, error } = await db
      .from('telecaller_lead_transfers')
      .insert([{
        lead_id: leadId,
        from_telecaller_id: profile.id,
        to_telecaller_id: toId,
        transfer_type: transferType,
        reason,
        status: 'COMPLETED',
      }])
      .select('*')
      .single();

    if (error) {
      // Table may not exist yet — still succeed transfer update
      console.warn('transfer log insert failed', error.message);
    }

    return NextResponse.json({ success: true, transfer: transfer || null });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Transfer failed' }, { status: 500 });
  }
}

/**
 * GET /api/telecaller/crm/transfer?peers=1
 * List peer telecallers for share/transfer picker.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClientFromRequest(request);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const profile = await resolveUserProfile(supabase, user);
    const { searchParams } = new URL(request.url);

    if (searchParams.get('peers') === '1') {
      const { supabaseAdmin } = getSupabaseAdmin();
      const db: any = supabaseAdmin || supabase;

      const { data: role } = await db
        .from('roles')
        .select('id')
        .eq('role_code', 'TELECALLER')
        .maybeSingle();

      let query = db
        .from('users_login')
        .select('id, full_name, phone, email, is_active')
        .eq('is_active', true)
        .order('full_name')
        .limit(100);

      if (role?.id) query = query.eq('role_id', role.id);
      // Keep all telecallers for Lead Manager filter; peers for self still exclude me
      const roleCode = String((profile as any)?.roles?.role_code || '').toUpperCase();
      if (profile?.id && roleCode === 'TELECALLER') query = query.neq('id', profile.id);

      const { data } = await query;
      return NextResponse.json({ success: true, peers: data || [] });
    }

    const leadId = searchParams.get('lead_id');
    if (leadId) {
      const { data } = await supabase
        .from('telecaller_lead_transfers')
        .select('*, from:from_telecaller_id(full_name), to:to_telecaller_id(full_name)')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });
      return NextResponse.json({ success: true, transfers: data || [] });
    }

    return NextResponse.json({ error: 'Specify peers=1 or lead_id' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 });
  }
}
