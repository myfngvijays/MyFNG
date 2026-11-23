import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';
import { isTelecallerCrmRole, normalizeRoleCode } from '@/lib/telecaller/crmRoles';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * "Mark as called" on a pending customer booking (App / Website / MISA).
 * Stamps coupon_meta.priority_booking_acked_at on a freshly re-read coupon_meta,
 * so the yellow highlight / banner goes away (see isPendingBookingLead).
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const leadId = String(id || '').trim();
  if (!leadId) return NextResponse.json({ error: 'Lead id missing' }, { status: 400 });

  const supabase = await createClientFromRequest(request);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const profile = await resolveUserProfile(supabase, user);
  const roleCode = normalizeRoleCode((profile as { roles?: { role_code?: string } })?.roles?.role_code);
  if (!isTelecallerCrmRole(roleCode)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const userId = String((profile as { id?: string })?.id || user.id);

  const { supabaseAdmin } = getSupabaseAdmin();
  const db: any = supabaseAdmin ?? supabase;

  const { data: lead, error: readError } = await db
    .from('service_leads')
    .select('id, coupon_meta, assigned_telecaller_id, created_by_id')
    .eq('id', leadId)
    .maybeSingle();
  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  if (roleCode === 'TELECALLER' && lead.assigned_telecaller_id !== userId && lead.created_by_id !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const meta = lead.coupon_meta && typeof lead.coupon_meta === 'object' ? lead.coupon_meta : {};
  const ackedAt = new Date().toISOString();
  const { error: updateError } = await db
    .from('service_leads')
    .update({ coupon_meta: { ...meta, priority_booking_acked_at: ackedAt } })
    .eq('id', leadId);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ ok: true, priority_booking_acked_at: ackedAt });
}
