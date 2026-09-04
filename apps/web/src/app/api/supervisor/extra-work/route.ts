import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export const dynamic = 'force-dynamic';

async function mapExtraWorkRows(rows: any[] | null, reader: any) {
  const requesterIds = Array.from(
    new Set((rows || []).map((r: any) => r.requested_by).filter(Boolean)),
  );
  const nameById = new Map<string, string>();
  if (requesterIds.length > 0) {
    const { data: people } = await reader
      .from('users_login')
      .select('id, full_name')
      .in('id', requesterIds);
    (people || []).forEach((p: any) => nameById.set(p.id, p.full_name || 'Mechanic'));
  }

  const requests = (rows || []).map((req: any) => {
    const lead = Array.isArray(req.service_leads) ? req.service_leads[0] : req.service_leads;
    return {
      id: req.id,
      lead_id: req.lead_id,
      lead_number: lead?.lead_number || '',
      customer_name: lead?.customer_name || 'Customer',
      vehicle_number: lead?.vehicle_number || '',
      mechanic_name: nameById.get(req.requested_by) || 'Mechanic',
      description: req.description,
      reason: req.reason,
      amount: Number(req.amount) || 0,
      category: req.category || 'EXTRA_WORK',
      is_urgent: !!req.is_urgent,
      created_at: req.created_at,
      status: String(req.status || 'PENDING').toUpperCase(),
      image_url: req.image_url || null,
      parts_breakdown: Array.isArray(req.parts_breakdown) ? req.parts_breakdown : [],
    };
  });

  return NextResponse.json({
    success: true,
    requests,
    pending_count: requests.filter((r) => r.status === 'PENDING').length,
    approved_count: requests.filter((r) => r.status === 'APPROVED').length,
    rejected_count: requests.filter((r) => r.status === 'REJECTED').length,
  });
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClientFromRequest(request);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const email = (user.email || '').trim();
    const phone = (user.phone || '').trim();
    const selectProfile = 'id, email, phone, full_name, workshop_id, role_id, roles!inner(role_code)';

    const { data: byEmail } = email
      ? await supabase.from('users_login').select(selectProfile).ilike('email', email).maybeSingle()
      : { data: null };
    const { data: byPhone } = !byEmail && phone
      ? await supabase.from('users_login').select(selectProfile).eq('phone', phone).maybeSingle()
      : { data: null };

    const profile = byEmail || byPhone;
    if (!profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const roleCode = (profile.roles as any)?.role_code;
    if (!['WORKSHOP_SUPERVISOR', 'WORKSHOP_ADMIN', 'SUPER_ADMIN'].includes(roleCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!profile.workshop_id && roleCode !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Workshop not set' }, { status: 400 });
    }

    const { supabaseAdmin } = getSupabaseAdmin();
    const reader = supabaseAdmin || supabase;
    const workshopId = profile.workshop_id;

    let query = reader
      .from('lead_extra_charges')
      .select(
        `
        id,
        lead_id,
        description,
        reason,
        amount,
        category,
        is_urgent,
        created_at,
        status,
        requested_by,
        image_url,
        parts_breakdown,
        service_leads!inner (
          lead_number,
          customer_name,
          vehicle_number,
          workshop_id,
          deleted_at
        )
      `,
      )
      .in('status', ['PENDING', 'APPROVED', 'REJECTED'])
      .is('service_leads.deleted_at', null)
      .order('created_at', { ascending: false });

    if (workshopId) {
      query = query.eq('service_leads.workshop_id', workshopId);
    }

    const { data: rows, error } = await query;
    if (error && /parts_breakdown/i.test(String(error.message || ''))) {
      query = reader
        .from('lead_extra_charges')
        .select(
          `
        id,
        lead_id,
        description,
        reason,
        amount,
        category,
        is_urgent,
        created_at,
        status,
        requested_by,
        image_url,
        service_leads!inner (
          lead_number,
          customer_name,
          vehicle_number,
          workshop_id,
          deleted_at
        )
      `,
        )
        .in('status', ['PENDING', 'APPROVED', 'REJECTED'])
        .is('service_leads.deleted_at', null)
        .order('created_at', { ascending: false });
      if (workshopId) query = query.eq('service_leads.workshop_id', workshopId);
      const retry = await query;
      if (retry.error) {
        return NextResponse.json(
          { error: 'Failed to load additional jobs', details: retry.error.message },
          { status: 500 },
        );
      }
      return await mapExtraWorkRows(retry.data, reader);
    }
    if (error) {
      return NextResponse.json(
        { error: 'Failed to load additional jobs', details: error.message },
        { status: 500 },
      );
    }

    return await mapExtraWorkRows(rows, reader);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to load additional jobs', details: message }, { status: 500 });
  }
}
