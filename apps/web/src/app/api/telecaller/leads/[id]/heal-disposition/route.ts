/**
 * Heal lead status/coupon_meta from an already-logged call disposition
 * (e.g. call history shows Lost but lead.status stayed NEW).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { DISPOSITION_TO_LEAD_STATUS } from '@/lib/telecaller/callDisposition';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClientFromRequest(request);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const profile = await resolveUserProfile(supabase, user);
    const roleCode = (profile?.roles as any)?.role_code || null;
    const allowed = new Set(['TELECALLER', 'SUPER_ADMIN', 'LEAD_MANAGER', 'SUB_ADMIN']);
    if (!allowed.has(String(roleCode || ''))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const leadId = String(id || '').trim();
    if (!leadId) return NextResponse.json({ error: 'Missing lead id' }, { status: 400 });

    const body = await request.json().catch(() => ({}));
    const result = String(body?.last_call_result || '').trim().toUpperCase();
    if (!result) {
      return NextResponse.json({ error: 'Nothing to heal' }, { status: 400 });
    }

    const { supabaseAdmin } = getSupabaseAdmin();
    const db = supabaseAdmin ?? supabase;

    const { data: lead, error } = await db
      .from('service_leads')
      .select('*')
      .eq('id', leadId)
      .maybeSingle();
    if (error || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    const meta = lead.coupon_meta && typeof lead.coupon_meta === 'object' ? lead.coupon_meta : {};
    const existingResult = String(meta.last_call_result || '').trim().toUpperCase();
    const existingLabel = String(meta.last_call_label || '').trim();
    const prevHistoryCheck = Array.isArray(meta.profile_history) ? meta.profile_history : [];
    const hasMatchingHistory = prevHistoryCheck.some(
      (entry: any) => String(entry?.status || '').toUpperCase() === result,
    );
    const hasRealDisposition =
      (existingResult && existingResult !== 'FRESH') ||
      (existingLabel && !/^fresh$/i.test(existingLabel) && !/^new$/i.test(existingLabel));
    if (hasRealDisposition && hasMatchingHistory) {
      return NextResponse.json({ success: true, healed: false, lead });
    }

    const label = String(body?.last_call_label || result).trim();
    const lostReason = body?.last_lost_reason != null ? String(body.last_lost_reason) : null;
    const nextStatus =
      String(body?.status || '').trim().toUpperCase() ||
      DISPOSITION_TO_LEAD_STATUS[result] ||
      null;
    const current = String(lead.status || '').toUpperCase();
    const canSetStatus =
      nextStatus &&
      (nextStatus === 'REJECTED' ||
        ['NEW', 'CONTACTED', 'INCOMPLETE', 'PENDING', 'ASSIGNED'].includes(current));

    const at = String(meta.last_call_at || new Date().toISOString());
    const remark =
      body?.telecaller_remarks != null
        ? String(body.telecaller_remarks).trim() || null
        : String(meta.telecaller_remarks || lead.telecaller_remarks || '').trim() || null;
    const prevHistory = Array.isArray(meta.profile_history) ? meta.profile_history : [];
    const hasHist = prevHistory.some(
      (entry: any) => String(entry?.status || '').toUpperCase() === result,
    );
    const historyEntry = {
      at,
      summary: `Lead updated · ${label}`,
      remark,
      status: result,
      event: 'STATUS',
    };
    const nextMeta = {
      ...meta,
      last_call_result: result,
      last_call_label: label,
      last_call_status: body?.last_call_status || meta.last_call_status || 'ANSWERED',
      last_call_at: at,
      last_lost_reason: lostReason || meta.last_lost_reason || null,
      telecaller_remarks: remark ?? meta.telecaller_remarks ?? null,
      profile_history: hasHist ? prevHistory : [historyEntry, ...prevHistory].slice(0, 50),
    };

    const patch: Record<string, unknown> = {
      coupon_meta: nextMeta,
      updated_at: new Date().toISOString(),
    };
    if (canSetStatus) patch.status = nextStatus;
    if (body?.total_calls != null) {
      const n = Number(body.total_calls);
      if (Number.isFinite(n) && n > Number(lead.total_calls || 0)) {
        patch.total_calls = n;
      }
    }

    const { data: updated, error: updErr } = await db
      .from('service_leads')
      .update(patch)
      .eq('id', leadId)
      .select('*')
      .maybeSingle();

    if (updErr) {
      return NextResponse.json({ error: updErr.message || 'Heal failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true, healed: true, lead: updated || { ...lead, ...patch } });
  } catch (e: any) {
    console.error('[heal-disposition]', e);
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 });
  }
}
