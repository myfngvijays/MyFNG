import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; extraWorkId: string }> }
) {
  try {
    const supabase = await createClient();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_KEY ||
      process.env.SUPABASE_ADMIN_KEY;

    const supabaseAdmin =
      supabaseUrl && serviceRoleKey
        ? createSupabaseAdminClient(supabaseUrl, serviceRoleKey, {
            auth: { persistSession: false, autoRefreshToken: false },
          })
        : null;

    const updater = supabaseAdmin ?? supabase;
    const { id: leadId, extraWorkId } = await params;

    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || '').toUpperCase(); // APPROVE / REJECT
    const partType = String(body?.part_price_type || 'OEM').toUpperCase(); // OEM / OES
    const rejectionReason = String(body?.rejection_reason || '').trim();

    if (action !== 'APPROVE' && action !== 'REJECT') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
    if (action === 'APPROVE' && partType !== 'OEM' && partType !== 'OES') {
      return NextResponse.json({ error: 'Invalid part_price_type' }, { status: 400 });
    }
    if (action === 'REJECT' && !rejectionReason) {
      return NextResponse.json({ error: 'rejection_reason is required' }, { status: 400 });
    }

    const { data: row, error: getErr } = await updater
      .from('lead_extra_charges')
      .select('*')
      .eq('id', extraWorkId)
      .maybeSingle();

    if (getErr || !row) return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    if (row.lead_id !== leadId) return NextResponse.json({ error: 'Request does not belong to lead' }, { status: 400 });
    if (row.status !== 'PENDING') return NextResponse.json({ error: `Not pending (${row.status})` }, { status: 400 });

    const now = new Date().toISOString();

    // Compute total based on customer selection (if price breakdown exists)
    const oem = Number(row.oem_price ?? 0);
    const oes = Number(row.oes_price ?? 0);
    const labour = Number(row.labour_price ?? 0);
    const total = (partType === 'OES' ? oes : oem) + labour;

    if (action === 'APPROVE') {
      const { error: updErr } = await updater
        .from('lead_extra_charges')
        .update(
          {
            status: 'APPROVED',
            customer_approved: true,
            customer_approved_at: now,
            part_price_type: partType,
            amount: total,
            rejection_reason: null,
          } as any
        )
        .eq('id', extraWorkId);

      if (updErr) {
        // Fallback for DBs without new columns: update only core fields
        const msg = String((updErr as any)?.message || '');
        if ((updErr as any)?.code === '42703' || /does not exist/i.test(msg)) {
          const { error: upd2 } = await updater
            .from('lead_extra_charges')
            .update({ status: 'APPROVED', amount: total, rejection_reason: null } as any)
            .eq('id', extraWorkId);
          if (upd2) return NextResponse.json({ error: (upd2 as any)?.message || 'Failed to approve' }, { status: 500 });
        } else {
          return NextResponse.json({ error: (updErr as any)?.message || 'Failed to approve' }, { status: 500 });
        }
      }
    } else {
      const { error: updErr } = await updater
        .from('lead_extra_charges')
        .update(
          {
            status: 'REJECTED',
            customer_approved: false,
            customer_approved_at: now,
            rejection_reason: rejectionReason,
          } as any
        )
        .eq('id', extraWorkId);

      if (updErr) {
        const msg = String((updErr as any)?.message || '');
        if ((updErr as any)?.code === '42703' || /does not exist/i.test(msg)) {
          const { error: upd2 } = await updater
            .from('lead_extra_charges')
            .update({ status: 'REJECTED', rejection_reason: rejectionReason } as any)
            .eq('id', extraWorkId);
          if (upd2) return NextResponse.json({ error: (upd2 as any)?.message || 'Failed to reject' }, { status: 500 });
        } else {
          return NextResponse.json({ error: (updErr as any)?.message || 'Failed to reject' }, { status: 500 });
        }
      }
    }

    // Best-effort lead event log (schema differs across deployments)
    try {
      await updater.from('lead_events').insert({
        lead_id: leadId,
        event_type: action === 'APPROVE' ? 'CUSTOMER_EXTRA_WORK_APPROVED' : 'CUSTOMER_EXTRA_WORK_REJECTED',
        event_description:
          action === 'APPROVE'
            ? `Customer approved additional work (${partType})`
            : `Customer rejected additional work: ${rejectionReason}`,
        created_at: now,
      } as any);
    } catch {
      // ignore
    }

    return NextResponse.json(
      {
        success: true,
        status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message || String(e) }, { status: 500 });
  }
}

