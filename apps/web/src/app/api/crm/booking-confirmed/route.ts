import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';

export const dynamic = 'force-dynamic';

const ALLOWED = new Set(['SUPER_ADMIN', 'SUB_ADMIN', 'LEAD_MANAGER', 'TELECALLER']);

/**
 * Leads whose booking was confirmed — same set that goes to the "Today send lead" sheet.
 * A lead counts when it is VALIDATED (Booking confirmed) now, or it carries a confirm stamp
 * (booking_confirmed_at / won_sheet_at) from before it moved on to In Service / Service Done.
 *
 * GET /api/crm/booking-confirmed?from=YYYY-MM-DD&to=YYYY-MM-DD&q=…&limit=…
 * Dates are IST days and match the confirm time.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClientFromRequest(request);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const profile = await resolveUserProfile(supabase, user);
    const role = String((profile?.roles as any)?.role_code || '').toUpperCase();
    if (!ALLOWED.has(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // Telecallers see only the bookings on leads assigned to them.
    const ownOnly = role === 'TELECALLER';
    const meId = String(profile?.id || '').trim();
    if (ownOnly && !meId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { supabaseAdmin } = getSupabaseAdmin();
    const db = supabaseAdmin ?? supabase;

    const sp = request.nextUrl.searchParams;
    const from = isYmd(sp.get('from')) ? String(sp.get('from')) : '';
    const to = isYmd(sp.get('to')) ? String(sp.get('to')) : '';
    const q = String(sp.get('q') || '').trim().toLowerCase();
    const limit = Math.min(Math.max(parseInt(sp.get('limit') || '500', 10) || 500, 1), 2000);

    // IST day bounds → UTC instants.
    const fromIso = from ? new Date(`${from}T00:00:00+05:30`).toISOString() : '';
    const toIso = to ? new Date(`${to}T23:59:59.999+05:30`).toISOString() : '';

    let query = db
      .from('service_leads')
      .select(
        `id, lead_number, customer_name, customer_phone, status, city, pincode, customer_address,
         vehicle_number, vehicle_make, vehicle_model, service_type, estimated_amount, pickup_required, notes,
         preferred_slot_start, created_at, updated_at, coupon_meta, assigned_telecaller_id,
         workshop:workshops(id, name),
         assigned_telecaller:users_login!assigned_telecaller_id(id, full_name)`,
      )
      .is('deleted_at', null)
      .or(
        // Status column can lag (list dropdown only moves it forward from NEW), so also trust the CRM label.
        'status.eq.VALIDATED,coupon_meta->>last_call_result.eq.BOOKING_CONFIRMED,coupon_meta->>booking_confirmed_at.not.is.null,coupon_meta->>won_sheet_at.not.is.null',
      )
      .order('updated_at', { ascending: false })
      .limit(3000);
    // Confirmed at ≤ updated_at, so anything confirmed in range was updated on/after `from`.
    if (fromIso) query = query.gte('updated_at', fromIso);
    if (ownOnly) query = query.eq('assigned_telecaller_id', meId);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    type Row = Record<string, any> & { confirmed_at: string };
    const rows: Row[] = ((data || []) as any[])
      .map((row: any): Row => {
        const meta = row.coupon_meta && typeof row.coupon_meta === 'object' ? row.coupon_meta : {};
        const confirmedAt = resolveConfirmedAt(row, meta);
        return {
          id: String(row.id),
          lead_number: row.lead_number || null,
          customer_name: row.customer_name || null,
          customer_phone: row.customer_phone || null,
          address:
            row.customer_address ||
            [meta.flat_number, meta.area, meta.landmark, row.city, row.pincode].filter(Boolean).join(', ') ||
            null,
          area: meta.area || row.city || null,
          city: row.city || null,
          pincode: row.pincode || null,
          vehicle_number: row.vehicle_number || null,
          vehicle_make: row.vehicle_make || null,
          vehicle_model: row.vehicle_model || null,
          vehicle_class: meta.vehicle_class || null,
          package: row.service_type || null,
          amount: row.estimated_amount ?? null,
          workshop: row.workshop?.name || null,
          visit_type: row.pickup_required ? 'Pickup' : 'Visit',
          preferred_slot: row.preferred_slot_start || null,
          telecaller: row.assigned_telecaller?.full_name || null,
          confirmed_by: meta.booking_confirmed_by_name || null,
          remark: meta.telecaller_remarks || null,
          note: row.notes || null,
          current_status: currentStatusLabel(row.status, meta),
          on_sheet: Boolean(meta.won_sheet_at),
          confirmed_at: confirmedAt,
        };
      })
      .filter((row: Row) => {
        if (fromIso && row.confirmed_at < fromIso) return false;
        if (toIso && row.confirmed_at > toIso) return false;
        if (!q) return true;
        return [row.customer_name, row.customer_phone, row.lead_number, row.vehicle_number, row.vehicle_model, row.telecaller, row.workshop, row.remark, row.note]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q));
      })
      .sort((a: Row, b: Row) => (a.confirmed_at < b.confirmed_at ? 1 : -1));

    return NextResponse.json({ success: true, total: rows.length, leads: rows.slice(0, limit) });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 });
  }
}

function isYmd(v: string | null) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));
}

/** Stamp first, then the sheet time, then the latest "Booking confirmed" history entry, else updated_at. */
function resolveConfirmedAt(row: any, meta: any): string {
  const stamp = String(meta.booking_confirmed_at || meta.won_sheet_at || '').trim();
  if (stamp) return new Date(stamp).toISOString();
  const history = Array.isArray(meta.profile_history) ? meta.profile_history : [];
  const hit = history.find((h: any) => {
    const st = String(h?.status || '').toUpperCase();
    return st === 'BOOKING_CONFIRMED' || /booking confirmed/i.test(String(h?.summary || ''));
  });
  if (hit?.at) return new Date(hit.at).toISOString();
  return new Date(row.updated_at || row.created_at).toISOString();
}

function currentStatusLabel(status: string, meta: any): string {
  const result = String(meta.last_call_result || '').toUpperCase();
  if (result === 'SERVICE_DONE') return 'Service Done';
  if (result === 'IN_SERVICE') return 'In Service';
  if (result === 'LOST' || String(status).toUpperCase() === 'REJECTED') return 'Lost';
  if (String(status).toUpperCase() === 'VALIDATED' || result === 'BOOKING_CONFIRMED') return 'Booking confirmed';
  return String(meta.last_call_label || status || '—');
}
