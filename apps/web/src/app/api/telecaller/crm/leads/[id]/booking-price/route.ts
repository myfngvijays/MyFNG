import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';
import { crmSeesAllLeads, isTelecallerCrmRole, normalizeRoleCode } from '@/lib/telecaller/crmRoles';
import { resolveCrmPermissionsForUser } from '@/lib/telecaller/resolveCrmPermissions';
import { buildLeadPriceSummary } from '@/lib/leadPriceSummary';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/telecaller/crm/leads/[id]/booking-price
 * Booking price line by line for ONE lead (services + add-ons, coupon, wallet used, membership, payable).
 * Telecallers: only their own lead and only with "Booking ka price dekhna" permission.
 * No wallet balance, account or other-customer data is returned.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
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

  const seesAll = crmSeesAllLeads(roleCode);
  if (!seesAll) {
    const perms = await resolveCrmPermissionsForUser(db, userId, roleCode).catch(() => null);
    if (perms?.permissions?.view_booking_price === false) {
      return NextResponse.json({ error: 'Not allowed', allowed: false }, { status: 403 });
    }
  }

  const { data: lead, error } = await db.from('service_leads').select('*').eq('id', leadId).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  if (!seesAll && lead.assigned_telecaller_id !== userId && lead.created_by_id !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const summary = await buildLeadPriceSummary(db, lead);
  return NextResponse.json({ ok: true, allowed: true, summary });
}
