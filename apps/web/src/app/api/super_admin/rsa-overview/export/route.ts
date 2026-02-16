import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function assertSuperAdmin(supabase: any) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }

  const { data: userData, error: roleError } = await supabase
    .from('users_login')
    .select('id, roles!inner(role_code)')
    .eq('id', user.id)
    .single();
  if (roleError || !userData) {
    return { ok: false, status: 403, error: 'Forbidden - Role check failed' };
  }

  const roleCode = String((userData as any).roles?.role_code || '').trim();
  if (!['SUPER_ADMIN', 'SUB_ADMIN'].includes(roleCode)) {
    return { ok: false, status: 403, error: 'Forbidden - Not super admin' };
  }
  return { ok: true, status: 200, error: null };
}

function normalizePincode(value?: string | null) {
  return String(value || '').replace(/\D/g, '').slice(0, 10);
}

function normalizeKey(value: string | null | undefined, fallback = '') {
  const raw = String(value || '').trim();
  return raw || fallback;
}

function parseLocation(address?: string | null, pincode?: string | null) {
  const raw = String(address || '').trim();
  const parts = raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  const state = normalizeKey(parts[parts.length - 1], 'Unknown');
  const district = normalizeKey(parts[parts.length - 2], normalizeKey(pincode, 'Unknown'));
  return { district, state };
}

function isResolved(lead: any) {
  const leadStatus = String(lead?.lead_status || '').toLowerCase();
  const complaintStatus = String(lead?.complaint_status || '').toLowerCase();
  return ['completed', 'closed'].includes(leadStatus) || ['completed', 'closed'].includes(complaintStatus);
}

function matchesStatusFilter(lead: any, statusFilter: string) {
  const normalized = String(statusFilter || '').trim().toLowerCase();
  if (!normalized || normalized === 'all') return true;
  const leadStatus = String(lead?.lead_status || '').trim().toLowerCase();
  const complaintStatus = String(lead?.complaint_status || '').trim().toLowerCase();
  if (normalized === 'unknown') {
    return (!leadStatus && !complaintStatus) || leadStatus === 'unknown' || complaintStatus === 'unknown';
  }
  if (normalized === 'resolved') return isResolved(lead);
  if (normalized === 'pending') return !isResolved(lead);
  return leadStatus === normalized || complaintStatus === normalized;
}

function statusKey(lead: any) {
  const leadStatus = String(lead?.lead_status || '').trim().toLowerCase();
  const complaintStatus = String(lead?.complaint_status || '').trim().toLowerCase();
  return leadStatus || complaintStatus || 'unknown';
}

function toCSVCell(value: any) {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) value = value.join('|');
  if (typeof value === 'object') value = JSON.stringify(value);
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = await assertSuperAdmin(supabase);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: adminError || 'Admin client not configured' }, { status: 500 });
    }
    const db = supabaseAdmin as any;

    const { searchParams } = new URL(request.url);
    const now = new Date();
    const defaultFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const from = searchParams.get('from') || defaultFrom.toISOString();
    const to = searchParams.get('to') || now.toISOString();
    const statusFilter = String(searchParams.get('status') || '').trim().toLowerCase();

    const dateFilter = `and(lead_registered_at.gte.${from},lead_registered_at.lte.${to}),and(requested_at.gte.${from},requested_at.lte.${to})`;
    const { data: leads, error } = await db
      .from('rsa_leads')
      .select('*')
      .eq('delete_status', false)
      .or(dateFilter);

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch RSA leads', details: error.message }, { status: 500 });
    }

    const rows = (Array.isArray(leads) ? leads : []).filter((lead: any) => matchesStatusFilter(lead, statusFilter));
    const pincodes = Array.from(new Set(rows.map((row: any) => normalizePincode(row?.pincode)).filter((v: string) => v)));
    const pincodeMap = new Map<string, { district: string | null; state: string | null }>();
    if (pincodes.length) {
      const { data: pincodeRows } = await db
        .from('pincode_city_state')
        .select('pincode, district, state')
        .in('pincode', pincodes);
      for (const row of pincodeRows || []) {
        const key = normalizePincode((row as any)?.pincode);
        if (!key) continue;
        pincodeMap.set(key, {
          district: (row as any)?.district || null,
          state: (row as any)?.state || null,
        });
      }
    }

    const headers = [
      'id',
      'customer_id',
      'vehicle_id',
      'service_type',
      'priority',
      'request_status',
      'requested_',
      'mechanic_assigned_datetime',
      'mechanic_reached_datetime',
      'mechanic_completed_datetime',
      'assigned_mechanic_id',
      'assigned_mechanic_name',
      'assigned_mechanic_contact',
      'vehicle_number',
      'contact_number',
      'alternate_number',
      'problem',
      'pincode',
      'payment_rcv',
      'payment_mechanic',
      'emp_name',
      'source',
      'remark',
      'register_datetime',
      'is_premium',
      'advance_payment',
      'assigned_remark',
      'dispatch_remark',
      'reached_remark',
      'complete_remark',
      'delete_status',
      'service_tag',
      'card_number',
      'location_link',
      'media_upload',
      'customer_quoted_amount',
      'complaint_registered_at',
      'registered_by_executive_id',
      'registered_by_executive_name',
      'whatsapp_location_sent',
      'whatsapp_location_sent_at',
      'complaint_status',
      'assigned_advisor_id',
      'assigned_advisor_name',
      'assigned_to_advisor_at',
      'customer_name',
      'updated_at',
      'cancelled_at',
      'mechanic_dispatched_datetime',
      'mechanic_started_datetime',
      'mechanic_cancelled_datetime',
      'mechanic_location',
      'mechanic_notes',
      'mechanic_completion_notes',
      'mechanic_cancellation_reason',
      'drop_location',
      'cancelled_remark',
      '__pincode_norm',
      '__district',
      '__state',
      '__status_key',
    ];

    const dataRows = rows.map((lead: any) => {
      const pincodeNorm = normalizePincode(lead?.pincode);
      const pincodeEntry = pincodeNorm ? pincodeMap.get(pincodeNorm) : null;
      const fallback = parseLocation(lead?.address, lead?.pincode);
      const district = normalizeKey(pincodeEntry?.district || fallback.district, 'Unknown');
      const state = normalizeKey(pincodeEntry?.state || fallback.state, 'Unknown');
      const row: Record<string, any> = {
        id: lead?.id ?? '',
        customer_id: lead?.customer_id ?? '',
        vehicle_id: lead?.vehicle_id ?? '',
        service_type: lead?.service_type ?? '',
        priority: lead?.priority ?? '',
        request_status: lead?.lead_status ?? lead?.complaint_status ?? '',
        requested_: lead?.requested_at ?? '',
        mechanic_assigned_datetime: lead?.mechanic_assigned_datetime ?? '',
        mechanic_reached_datetime: lead?.mechanic_reached_datetime ?? '',
        mechanic_completed_datetime: lead?.mechanic_completed_datetime ?? '',
        assigned_mechanic_id: lead?.assigned_mechanic_id ?? '',
        assigned_mechanic_name: lead?.assigned_mechanic_name ?? '',
        assigned_mechanic_contact: lead?.assigned_mechanic_contact ?? '',
        vehicle_number: lead?.vehicle_number ?? '',
        contact_number: lead?.contact_number ?? '',
        alternate_number: lead?.alternate_number ?? '',
        problem: lead?.problem ?? '',
        pincode: lead?.pincode ?? '',
        payment_rcv: lead?.payment_received ?? '',
        payment_mechanic: lead?.payment_to_mechanic ?? '',
        emp_name: lead?.assigned_manager_name ?? lead?.registered_by_name ?? '',
        source: lead?.source ?? '',
        remark: lead?.remark ?? '',
        register_datetime: lead?.register_datetime ?? '',
        is_premium: lead?.is_premium ?? '',
        advance_payment: lead?.advance_payment ?? '',
        assigned_remark: lead?.assigned_remark ?? '',
        dispatch_remark: lead?.dispatch_remark ?? '',
        reached_remark: lead?.reached_remark ?? '',
        complete_remark: lead?.complete_remark ?? '',
        delete_status: lead?.delete_status ?? '',
        service_tag: lead?.service_tag ?? '',
        card_number: (lead as any)?.card_number ?? '',
        location_link: lead?.location_link ?? '',
        media_upload: lead?.media_upload ?? '',
        customer_quoted_amount: lead?.customer_quoted_amount ?? '',
        complaint_registered_at: lead?.lead_registered_at ?? '',
        registered_by_executive_id: lead?.registered_by_id ?? '',
        registered_by_executive_name: lead?.registered_by_name ?? '',
        whatsapp_location_sent: (lead as any)?.whatsapp_location_sent ?? '',
        whatsapp_location_sent_at: (lead as any)?.whatsapp_location_sent_at ?? '',
        complaint_status: lead?.complaint_status ?? '',
        assigned_advisor_id: lead?.assigned_manager_id ?? '',
        assigned_advisor_name: lead?.assigned_manager_name ?? '',
        assigned_to_advisor_at: lead?.assigned_to_manager_at ?? '',
        customer_name: lead?.customer_name ?? '',
        updated_at: lead?.updated_at ?? '',
        cancelled_at: lead?.cancelled_at ?? '',
        mechanic_dispatched_datetime: (lead as any)?.mechanic_dispatched_datetime ?? lead?.mechanic_assigned_datetime ?? '',
        mechanic_started_datetime: lead?.mechanic_started_datetime ?? '',
        mechanic_cancelled_datetime: lead?.mechanic_cancelled_datetime ?? '',
        mechanic_location: lead?.mechanic_location ?? '',
        mechanic_notes: lead?.mechanic_notes ?? '',
        mechanic_completion_notes: lead?.mechanic_completion_notes ?? '',
        mechanic_cancellation_reason: lead?.mechanic_cancellation_reason ?? '',
        drop_location: lead?.drop_location ?? '',
        cancelled_remark: lead?.cancelled_remark ?? '',
        __pincode_norm: pincodeNorm,
        __district: district,
        __state: state,
        __status_key: statusKey(lead),
      };
      return row;
    });

    const csvLines = [headers.join(',')];
    for (const row of dataRows) {
      csvLines.push(headers.map((header) => toCSVCell(row[header])).join(','));
    }
    const csv = csvLines.join('\n');
    const dateTag = new Date().toISOString().slice(0, 10);

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="rsa-overview-customers-${dateTag}.csv"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal server error', details: error?.message }, { status: 500 });
  }
}
