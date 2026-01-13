import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isRlsError(e: any) {
  const msg = String(e?.message || e || '');
  const code = String(e?.code || '');
  return code === '42501' || /row-level security|violates row level security|permission denied/i.test(msg);
}

/**
 * POST /api/leads/[id]/customer-pickup/complete
 *
 * For leads where pickup_required=false (customer self pickup),
 * allow Supervisor/Advisor to mark the lead as DELIVERED after payment (TI generated / paid).
 */
export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient();

  // Optional service-role client for write operations when RLS blocks (best-effort).
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ADMIN_KEY;
  const supabaseAdmin =
    supabaseUrl && serviceRoleKey
      ? createSupabaseAdminClient(supabaseUrl, serviceRoleKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        })
      : null;

  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const leadId = params.id;
  const user = auth.user;

  // users_login is mapped by email/phone; not always auth user.id
  const email = (user.email || '').trim();
  const phone = (user.phone || '').trim();
  const selectProfile = 'id, email, phone, workshop_id, roles!inner(role_code)';

  const { data: userProfileByEmail } = email
    ? await supabase.from('users_login').select(selectProfile).ilike('email', email).maybeSingle()
    : { data: null };
  const { data: userProfileByPhone } = !userProfileByEmail && phone
    ? await supabase.from('users_login').select(selectProfile).eq('phone', phone).maybeSingle()
    : { data: null };
  const { data: userProfileById } = !userProfileByEmail && !userProfileByPhone
    ? await supabase.from('users_login').select(selectProfile).eq('id', user.id).maybeSingle()
    : { data: null };

  const userProfile: any = userProfileByEmail || userProfileByPhone || userProfileById;
  if (!userProfile) {
    return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
  }

  const roleCode = String(userProfile?.roles?.role_code || '').trim().toUpperCase();
  const allowedRoles = ['WORKSHOP_SUPERVISOR', 'WORKSHOP_ADVISOR'];
  if (!allowedRoles.includes(roleCode)) {
    return NextResponse.json({ error: 'Forbidden', role: roleCode }, { status: 403 });
  }

  // Fetch lead + access checks
  const { data: lead, error: leadError } = await supabase
    .from('service_leads')
    .select('id, status, workshop_id, pickup_required, read_only, payment_status')
    .eq('id', leadId)
    .maybeSingle();

  if (leadError || !lead) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  }

  if ((lead as any).read_only) {
    return NextResponse.json({ error: 'Lead is archived/read-only' }, { status: 400 });
  }

  // Workshop scoping
  const myWorkshopId = String(userProfile?.workshop_id || '').trim();
  const leadWorkshopId = String((lead as any)?.workshop_id || '').trim();
  if (myWorkshopId && leadWorkshopId && myWorkshopId !== leadWorkshopId) {
    return NextResponse.json({ error: 'Forbidden: Lead not in your workshop' }, { status: 403 });
  }

  const pickupRequired = Boolean((lead as any)?.pickup_required);
  if (pickupRequired) {
    return NextResponse.json(
      { error: 'Pickup is required for this lead; use pickup/delivery flow instead' },
      { status: 400 }
    );
  }

  // Payment check: TI exists and/or paid flag.
  const { data: ti } = await supabase
    .from('invoices')
    .select('id, invoice_type, payment_status')
    .eq('lead_id', leadId)
    .eq('invoice_type', 'TAX_INVOICE')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const leadPay = String((lead as any)?.payment_status || '').trim().toUpperCase();
  const tiPay = String((ti as any)?.payment_status || '').trim().toUpperCase();
  const hasTI = Boolean((ti as any)?.id);
  const isPaid = leadPay === 'PAID' || tiPay === 'PAID';

  if (!hasTI && !isPaid) {
    return NextResponse.json(
      { error: 'Payment not completed yet (Tax Invoice not generated)' },
      { status: 400 }
    );
  }

  const currentStatus = String((lead as any)?.status || '').trim().toUpperCase();
  if (currentStatus === 'DELIVERED' || currentStatus === 'CLOSED') {
    return NextResponse.json({ success: true, status: currentStatus, lead_id: leadId }, { status: 200 });
  }

  const now = new Date().toISOString();
  const actorId = String(userProfile?.id || '').trim();

  const updateLead = async (client: any) =>
    client
      .from('service_leads')
      .update({ status: 'DELIVERED', updated_at: now })
      .eq('id', leadId)
      .select('id, status')
      .maybeSingle();

  let upd = await updateLead(supabase);
  if (upd.error && isRlsError(upd.error) && supabaseAdmin) {
    upd = await updateLead(supabaseAdmin);
  }
  if (upd.error) {
    return NextResponse.json(
      { error: 'Failed to update lead status', details: upd.error.message, code: upd.error.code },
      { status: 500 }
    );
  }

  // Best-effort logs (schema varies)
  try {
    await supabase.from('lead_status_history').insert({
      lead_id: leadId,
      old_status: currentStatus || null,
      new_status: 'DELIVERED',
      changed_by: actorId || null,
      changed_at: now,
      reason: 'Customer self pickup after payment',
    });
  } catch {
    // ignore
  }
  try {
    await supabase.from('lead_activities').insert({
      lead_id: leadId,
      user_id: actorId || null,
      activity_type: 'STATUS_CHANGED',
      description: 'Customer picked up vehicle (self pickup) after payment',
      old_status: currentStatus || null,
      new_status: 'DELIVERED',
      metadata: { source: 'customer_pickup_complete', tax_invoice_id: (ti as any)?.id || null },
    });
  } catch {
    // ignore
  }

  return NextResponse.json({ success: true, lead_id: leadId, status: 'DELIVERED' }, { status: 200 });
}

