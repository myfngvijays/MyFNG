import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { leadDisplayStatus } from '@/lib/telecaller/leadDisplayStatus';
import { istDayBounds } from '@/lib/telecaller/crmDateRange';
import { titleCasePersonName } from '@/lib/telecaller/personName';

export const dynamic = 'force-dynamic';

/**
 * POST /api/telecaller/crm/transfer
 * Peer transfer / soft-share a service lead to another telecaller.
 * TRANSFER / ESCALATE: only assigned_telecaller_id changes; lead row is otherwise untouched.
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
      .select('id, assigned_telecaller_id, status, customer_name, coupon_meta, is_incomplete')
      .eq('id', leadId)
      .maybeSingle();

    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

    if (transferType === 'TRANSFER' || transferType === 'ESCALATE') {
      const { error: updErr } = await db
        .from('service_leads')
        .update({
          assigned_telecaller_id: toId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', leadId);
      if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 });
    }

    const statusSnapshot = leadDisplayStatus(lead);
    const { data: transfer, error } = await db
      .from('telecaller_lead_transfers')
      .insert([{
        lead_id: leadId,
        from_telecaller_id: profile.id,
        to_telecaller_id: toId,
        transfer_type: transferType,
        reason,
        status: 'COMPLETED',
        lead_status_at_transfer: String(lead.status || '').trim() || null,
        lead_display_status_at_transfer: statusSnapshot || null,
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
      const peers = (data || []).map((row: any) => ({
        ...row,
        name: String(row?.full_name || '').trim(),
      }));
      return NextResponse.json({ success: true, peers });
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

    if (searchParams.get('outgoing') === '1') {
      const { supabaseAdmin } = getSupabaseAdmin();
      const db: any = supabaseAdmin || supabase;
      const roleCode = String((profile as any)?.roles?.role_code || '').toUpperCase();
      const scopeId = String(searchParams.get('from_telecaller_id') || '').trim() || String(profile.id);

      if (roleCode === 'TELECALLER' && scopeId !== String(profile.id)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const embedSelect =
        `id, created_at, transfer_type,
          to:to_telecaller_id(full_name),
          lead:lead_id(customer_name, status, coupon_meta, is_incomplete, telecaller_remarks)`;

      const runOutgoingQuery = (withSnapshot: boolean) => {
        const select = withSnapshot
          ? `id, created_at, transfer_type, lead_display_status_at_transfer, lead_status_at_transfer,
          to:to_telecaller_id(full_name),
          lead:lead_id(customer_name, status, coupon_meta, is_incomplete, telecaller_remarks)`
          : embedSelect;

        let q = db
          .from('telecaller_lead_transfers')
          .select(select)
          .eq('from_telecaller_id', scopeId)
          .in('transfer_type', ['TRANSFER', 'ESCALATE'])
          .order('created_at', { ascending: false })
          .limit(500);

        const allTime = searchParams.get('all_time') === '1';
        if (!allTime) {
          const fromYmd = String(searchParams.get('from') || '').slice(0, 10);
          const toYmd = String(searchParams.get('to') || '').slice(0, 10);
          if (/^\d{4}-\d{2}-\d{2}$/.test(fromYmd)) {
            q = q.gte('created_at', istDayBounds(fromYmd).start);
          }
          if (/^\d{4}-\d{2}-\d{2}$/.test(toYmd)) {
            q = q.lte('created_at', istDayBounds(toYmd).end);
          }
        }
        return q;
      };

      let { data, error } = await runOutgoingQuery(true);
      if (error && /lead_(display_)?status_at_transfer/i.test(String(error.message || ''))) {
        ({ data, error } = await runOutgoingQuery(false));
      }
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });

      const items = (data || []).map((row: any) => {
        const lead = row.lead && typeof row.lead === 'object' ? row.lead : {};
        const atTransfer =
          String(row.lead_display_status_at_transfer || '').trim() ||
          String(row.lead_status_at_transfer || '').trim() ||
          '—';
        const nowStatus = leadDisplayStatus(lead) || '—';
        return {
          id: row.id,
          transferred_at: row.created_at,
          customer_name: titleCasePersonName(lead.customer_name) || 'Unknown',
          transferred_to: String(row.to?.full_name || '').trim() || '—',
          status_at_transfer: atTransfer,
          status_now: nowStatus,
        };
      });

      return NextResponse.json({ success: true, items, count: items.length });
    }

    return NextResponse.json({ error: 'Specify peers=1, lead_id, or outgoing=1' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 });
  }
}
