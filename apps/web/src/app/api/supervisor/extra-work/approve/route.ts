import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { notifyExtraWorkDecision, notifyWorkshopRoles, notifyTelecallerForLead } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

type RoleCode = 'WORKSHOP_SUPERVISOR';

async function getAuthedProfile(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { profile: null as any, roleCode: null as string | null, error: 'Unauthorized' as const };

  const email = (user.email || '').trim();
  const phone = (user.phone || '').trim();
  const selectProfile = 'id, email, phone, full_name, workshop_id, role_id, roles!inner(role_code)';

  const { data: userProfileByEmail } = email
    ? await supabase.from('users_login').select(selectProfile).ilike('email', email).maybeSingle()
    : { data: null };
  const { data: userProfileByPhone } = !userProfileByEmail && phone
    ? await supabase.from('users_login').select(selectProfile).eq('phone', phone).maybeSingle()
    : { data: null };
  const { data: userProfileById } = !userProfileByEmail && !userProfileByPhone
    ? await supabase.from('users_login').select(selectProfile).eq('id', user.id).maybeSingle()
    : { data: null };

  const profile = userProfileByEmail || userProfileByPhone || userProfileById;
  const roleCode = (profile?.roles as any)?.role_code || null;
  return { profile, roleCode, error: profile ? null : ('User profile not found' as const) };
}

function isRoleAllowed(roleCode: string | null): roleCode is RoleCode {
  return roleCode === 'WORKSHOP_SUPERVISOR';
}

export async function POST(request: NextRequest) {
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

    const { profile, roleCode, error } = await getAuthedProfile(supabase);
    if (error === 'Unauthorized') return NextResponse.json({ error }, { status: 401 });
    if (!profile) return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    if (!isRoleAllowed(roleCode)) return NextResponse.json({ error: 'Forbidden: Supervisor only' }, { status: 403 });
    if (!profile.workshop_id) return NextResponse.json({ error: 'Workshop not set for user' }, { status: 400 });

    const body = await request.json().catch(() => ({}));
    const id = String(body?.id || '').trim();
    const partTypeRaw = String(body?.part_price_type || 'OEM').toUpperCase().trim();
    const part_price_type = partTypeRaw === 'OES' ? 'OES' : 'OEM';
    const notesRaw = body?.notes;
    const notes = typeof notesRaw === 'string' ? notesRaw.trim() : '';
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const oem_price_in = body?.oem_price;
    const oes_price_in = body?.oes_price;
    const labour_price_in = body?.labour_price;

    const parsedPricing = {
      oem_price:
        oem_price_in === undefined || oem_price_in === null || oem_price_in === ''
          ? null
          : Number(oem_price_in),
      oes_price:
        oes_price_in === undefined || oes_price_in === null || oes_price_in === ''
          ? null
          : Number(oes_price_in),
      labour_price:
        labour_price_in === undefined || labour_price_in === null || labour_price_in === ''
          ? null
          : Number(labour_price_in),
    };

    for (const [k, v] of Object.entries(parsedPricing)) {
      if (v === null) continue;
      if (!Number.isFinite(v) || v < 0) {
        return NextResponse.json({ error: `Invalid ${k}` }, { status: 400 });
      }
    }

    const updater = supabaseAdmin ?? supabase;

    // Load request + lead ownership; schema tolerant (oem/oes/labour may not exist)
    let reqRow: any = null;
    try {
      const { data, error: reqErr } = await updater
        .from('lead_extra_charges')
        .select('id, lead_id, status, description, amount, oem_price, oes_price, labour_price, customer_approved_at, rejection_reason')
        .eq('id', id)
        .maybeSingle();
      if (reqErr) throw reqErr;
      reqRow = data;
    } catch (e: any) {
      if (e?.code === '42703' || /does not exist/i.test(String(e?.message || ''))) {
        const { data } = await updater
          .from('lead_extra_charges')
          .select('id, lead_id, status, description, amount')
          .eq('id', id)
          .maybeSingle();
        reqRow = data;
      } else {
        throw e;
      }
    }

    if (!reqRow) return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    const status = String(reqRow.status || '').toUpperCase();
    const isCustomerRejected = status === 'REJECTED' && Boolean(reqRow.customer_approved_at);
    if (status !== 'PENDING' && !isCustomerRejected) {
      return NextResponse.json({ error: `Cannot approve from status ${reqRow.status}` }, { status: 400 });
    }
    if (isCustomerRejected && !notes) {
      return NextResponse.json(
        { error: 'Remark/notes is required to override customer rejection' },
        { status: 400 }
      );
    }

    const { data: lead, error: leadErr } = await updater
      .from('service_leads')
      .select('id, workshop_id, lead_number, assigned_mechanic_id')
      .eq('id', reqRow.lead_id)
      .maybeSingle();
    if (leadErr || !lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    if (lead.workshop_id !== profile.workshop_id) {
      return NextResponse.json({ error: 'Forbidden (different workshop)' }, { status: 403 });
    }

    const oem = parsedPricing.oem_price !== null ? parsedPricing.oem_price : Number(reqRow?.oem_price ?? 0);
    const oes = parsedPricing.oes_price !== null ? parsedPricing.oes_price : Number(reqRow?.oes_price ?? 0);
    const labour = parsedPricing.labour_price !== null ? parsedPricing.labour_price : Number(reqRow?.labour_price ?? 0);
    const legacyAmount = Number(reqRow?.amount ?? 0);
    const computedTotal = (() => {
      // If new price breakdown exists, compute based on selected part type.
      // Rule: if selected part price is 0, do NOT add labour into that option total.
      if (Number.isFinite(oem) || Number.isFinite(oes) || Number.isFinite(labour)) {
        const parts =
          part_price_type === 'OES' ? (Number.isFinite(oes) ? oes : 0) : (Number.isFinite(oem) ? oem : 0);
        const lab = Number.isFinite(labour) ? labour : 0;
        return parts > 0 ? parts + lab : 0;
      }
      // Legacy fallback: use stored amount.
      return Number.isFinite(legacyAmount) ? legacyAmount : 0;
    })();

    if (!Number.isFinite(computedTotal) || computedTotal <= 0) {
      return NextResponse.json(
        { error: 'Invalid computed total for approval', computedTotal, part_price_type },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    // Update request as approved by advisor.
    // If this is an override after customer rejection, preserve customer's timestamp + remark
    // so the supervisor can see both "Customer remark" and "Advisor remark" later.
    const payload: any = {
      status: 'APPROVED',
      part_price_type,
      amount: computedTotal,
      // Persist pricing override (if provided). If schema doesn't have these columns, we fallback below.
      oem_price: Number.isFinite(oem) ? oem : undefined,
      oes_price: Number.isFinite(oes) ? oes : undefined,
      labour_price: Number.isFinite(labour) ? labour : undefined,
      customer_approved: false,
      customer_approved_at: isCustomerRejected ? reqRow.customer_approved_at : null,
      rejection_reason: isCustomerRejected ? (reqRow.rejection_reason ?? null) : null,
      supervisor_approved_by: profile.id,
      supervisor_approval_notes: notes || (isCustomerRejected ? 'Override approved by supervisor' : 'Approved by supervisor'),
      approval_responded_at: now,
    };
    Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);

    let updErr: any = null;
    const upd1 = await updater.from('lead_extra_charges').update(payload).eq('id', id);
    updErr = upd1.error;

    if (updErr && (updErr as any)?.code === '42703') {
      // Legacy fallback: update only core fields
      const upd2 = await updater.from('lead_extra_charges').update({ status: 'APPROVED', amount: computedTotal } as any).eq('id', id);
      if (upd2.error) return NextResponse.json({ error: (upd2.error as any)?.message || 'Failed to approve' }, { status: 500 });
    } else if (updErr) {
      return NextResponse.json({ error: (updErr as any)?.message || 'Failed to approve' }, { status: 500 });
    }

    // Best-effort event log
    try {
      const priorRejection = isCustomerRejected ? String(reqRow?.rejection_reason || '').trim() : '';
      const remark = notes ? ` Remark: ${notes}` : '';
      await updater.from('lead_events').insert({
        lead_id: reqRow.lead_id,
        event_type: 'ADVISOR_EXTRA_WORK_APPROVED',
        event_description: isCustomerRejected
          ? `Advisor override approved after customer rejection (${part_price_type}): ${String(reqRow.description || '').trim() || 'Item'}${priorRejection ? ` • Customer reason: ${priorRejection}` : ''}${remark}`
          : `Advisor approved additional work (${part_price_type}): ${String(reqRow.description || '').trim() || 'Item'}${remark}`,
        created_at: now,
      } as any);
    } catch {
      // ignore
    }

    // In-app notifications (Phase A)
    try {
      const leadNumber = (lead as any)?.lead_number || reqRow.lead_id;
      const mechanicId = (lead as any)?.assigned_mechanic_id;
      const supervisorName = (profile as any)?.full_name || 'Supervisor';

      if (mechanicId) {
        await notifyExtraWorkDecision(
          reqRow.lead_id,
          leadNumber,
          mechanicId,
          true,
          computedTotal,
          supervisorName
        );
      }

      await notifyWorkshopRoles({
        workshopId: profile.workshop_id,
        roleCodes: ['WORKSHOP_ADMIN'],
        type: 'EXTRA_WORK_APPROVED',
        title: 'Extra work approved',
        message: `Extra work approved for lead ${leadNumber}. Amount: ₹${computedTotal}`,
        priority: 'LOW',
        leadId: reqRow.lead_id,
        leadNumber,
        actionUrl: `/dashboard/workshop_admin/leads/pending`,
        metadata: { extra_work_id: id, amount: computedTotal },
      });

      // Notify telecaller about extra work approval
      await notifyTelecallerForLead({
        leadId: reqRow.lead_id,
        leadNumber,
        type: 'EXTRA_WORK_APPROVED',
        title: 'Extra work approved',
        message: `Additional work approved for lead ${leadNumber}. Amount: ₹${computedTotal}.`,
        priority: 'MEDIUM',
        metadata: { extra_work_id: id, amount: computedTotal },
      });
    } catch (e) {
      console.warn('Extra work approval notifications failed (non-blocking):', e);
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message || String(e) }, { status: 500 });
  }
}

