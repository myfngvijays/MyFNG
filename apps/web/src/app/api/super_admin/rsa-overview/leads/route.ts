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
    return { ok: false, status: 401, error: 'Unauthorized', user: null };
  }

  const { data: userData, error: roleError } = await supabase
    .from('users_login')
    .select('id, roles!inner(role_code)')
    .eq('id', user.id)
    .single();
  if (roleError || !userData) {
    return { ok: false, status: 403, error: 'Forbidden - Role check failed', user };
  }
  const roleCode = (userData as any).roles?.role_code;
  if (!['SUPER_ADMIN', 'SUB_ADMIN'].includes(roleCode)) {
    return { ok: false, status: 403, error: 'Forbidden - Not super admin', user };
  }
  return { ok: true, status: 200, error: null, user };
}

function normalizeKey(value: string | null | undefined, fallback: string) {
  const raw = String(value || '').trim();
  return raw ? raw : fallback;
}

function normalizePincode(value?: string | null) {
  return String(value || '').replace(/\D/g, '').slice(0, 10);
}

function parseLocation(address?: string | null, pincode?: string | null) {
  const raw = String(address || '').trim();
  const parts = raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  const state = normalizeKey(parts[parts.length - 1], 'Unknown');
  const district = normalizeKey(parts[parts.length - 2], normalizeKey(pincode, 'Unknown'));
  return { state, district };
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
    const filterType = String(searchParams.get('type') || '').trim();
    const filterValue = String(searchParams.get('value') || '').trim();

    if (!filterType) {
      return NextResponse.json({ error: 'type is required' }, { status: 400 });
    }
    // For "all", value is optional.
    if (filterType !== 'all' && !filterValue) {
      return NextResponse.json({ error: 'type and value are required' }, { status: 400 });
    }

    const dateFilter = `and(lead_registered_at.gte.${from},lead_registered_at.lte.${to}),and(requested_at.gte.${from},requested_at.lte.${to})`;
    const { data: leads, error } = await db
      .from('rsa_leads')
      .select(
        `
        id,
        customer_name,
        contact_number,
        vehicle_number,
        service_type,
        service_tag,
        lead_status,
        complaint_status,
        lead_registered_at,
        requested_at,
        address,
        pincode,
        customer_quoted_amount,
        advance_payment,
        payment_received,
        payment_to_mechanic,
        assigned_mechanic_id,
        assigned_mechanic_name,
        assigned_manager_id,
        assigned_manager_name,
        registered_by_id,
        registered_by_name
      `
      )
      .eq('delete_status', false)
      .or(dateFilter);

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch RSA leads' }, { status: 500 });
    }

    const rows = Array.isArray(leads) ? leads : [];
    const pincodes = Array.from(
      new Set(
        rows
          .map((row: any) => normalizePincode(row?.pincode))
          .filter((value: string) => value)
      )
    );
    const pincodeMap = new Map<string, { district: string | null; state: string | null }>();
    if (pincodes.length) {
      const { data: pincodeRows } = await db
        .from('pincode_city_state')
        .select('pincode, district, state')
        .in('pincode', pincodes);
      for (const row of pincodeRows || []) {
        const key = normalizePincode(row?.pincode);
        if (!key) continue;
        pincodeMap.set(key, {
          district: row?.district || null,
          state: row?.state || null,
        });
      }
    }

    const filtered = rows.filter((lead: any) => {
      if (!matchesStatusFilter(lead, statusFilter)) return false;
      if (filterType === 'all') return true;
      if (filterType === 'department') {
        const department = normalizeKey(lead.service_type || lead.service_tag, 'Unknown');
        return department === filterValue;
      }
      if (filterType === 'employee') {
        const employeeId = normalizeKey(lead.assigned_manager_id || lead.registered_by_id, 'Unassigned');
        if (filterValue === 'Unassigned') {
          return employeeId === 'Unassigned';
        }
        return employeeId === filterValue;
      }
      if (filterType === 'mechanic') {
        const mechanicId = normalizeKey(lead.assigned_mechanic_id, 'Unassigned');
        if (filterValue === 'Unassigned') {
          return mechanicId === 'Unassigned';
        }
        return mechanicId === filterValue;
      }
      if (filterType === 'district' || filterType === 'state') {
        const normalizedPin = normalizePincode(lead.pincode);
        const pincodeEntry = normalizedPin ? pincodeMap.get(normalizedPin) : null;
        const fallback = parseLocation(lead.address, lead.pincode);
        const district = normalizeKey(pincodeEntry?.district || fallback.district, 'Unknown');
        const state = normalizeKey(pincodeEntry?.state || fallback.state, 'Unknown');
        return filterType === 'district' ? district === filterValue : state === filterValue;
      }
      return false;
    });

    return NextResponse.json({
      leads: filtered,
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal server error', details: error?.message }, { status: 500 });
  }
}
