import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';
import { PANEL_ACCESS_ROLES } from '@/lib/super-admin-auth';
import { normalizeCustomerPhone } from '@/lib/customer-service-leads';
import { appendLeadProfileHistory } from '@/lib/service-lead-reopen';

export const dynamic = 'force-dynamic';

/**
 * Deleted (soft-deleted) service leads — list and restore.
 *
 * GET  /api/crm/deleted-leads?days=30&q=…   → leads with deleted_at set
 * POST /api/crm/deleted-leads { id }         → clears deleted_at
 *
 * Admins and lead managers see all and can restore (same roles as Bookings & Leads).
 * Telecallers see only deleted leads that were assigned to them, read-only.
 * A lead is not restored while another open lead exists for the same phone:
 * the TeleCRM phone merge would otherwise fold one into the other.
 */

async function authorize(request: NextRequest, opts: { allowTelecaller?: boolean } = {}) {
  const supabase = await createClientFromRequest(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return { ok: false as const, res: NextResponse.json({ error: 'Admin client not configured' }, { status: 500 }) };
  }
  const profile = await resolveUserProfile(supabaseAdmin as any, user);
  const role = String((profile?.roles as any)?.role_code || '').toUpperCase();
  const isAdmin = (PANEL_ACCESS_ROLES.bookings as readonly string[]).includes(role);
  const isTelecaller = role === 'TELECALLER' && Boolean(opts.allowTelecaller) && Boolean(profile?.id);
  if (!isAdmin && !isTelecaller) {
    return { ok: false as const, res: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return {
    ok: true as const,
    ownOnly: !isAdmin,
    db: supabaseAdmin as any,
    userId: String(profile?.id || user.id),
    userName: String((profile as any)?.full_name || user.email || 'Admin'),
  };
}

function phoneVariants(phone10: string) {
  return [phone10, `91${phone10}`, `+91${phone10}`];
}

type OpenLead = { id: string; lead_number: string | null };

/**
 * phone10 → open (not deleted) lead, plus lead_number → the open lead it was merged into
 * (from PHONE_DUPLICATE_MERGED history on the open lead).
 */
async function openLeadsByPhone(db: any, phones: string[]) {
  const map = new Map<string, OpenLead>();
  const mergedInto = new Map<string, OpenLead & { at: string | null }>();
  const uniq = Array.from(new Set(phones.filter(Boolean)));
  for (let i = 0; i < uniq.length; i += 100) {
    const chunk = uniq.slice(i, i + 100);
    const { data } = await db
      .from('service_leads')
      .select('id, lead_number, customer_phone, coupon_meta')
      .in('customer_phone', chunk.flatMap(phoneVariants))
      .is('deleted_at', null)
      .limit(1000);
    for (const row of (data || []) as any[]) {
      const p = normalizeCustomerPhone(row.customer_phone);
      const open = { id: String(row.id), lead_number: row.lead_number || null };
      if (p && !map.has(p)) map.set(p, open);
      const history = Array.isArray(row.coupon_meta?.profile_history) ? row.coupon_meta.profile_history : [];
      for (const h of history) {
        if (h?.event === 'PHONE_DUPLICATE_MERGED' && h?.previous_label) {
          mergedInto.set(String(h.previous_label), { ...open, at: h.at || null });
        }
      }
    }
  }
  return { map, mergedInto };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await authorize(request, { allowTelecaller: true });
    if (!auth.ok) return auth.res;
    const { db, ownOnly, userId } = auth;

    const sp = request.nextUrl.searchParams;
    const q = String(sp.get('q') || '').trim();
    const days = Math.min(Math.max(parseInt(sp.get('days') || '30', 10) || 30, 1), 365);
    const sinceIso = new Date(Date.now() - days * 86_400_000).toISOString();

    let query = db
      .from('service_leads')
      .select(
        `id, lead_number, customer_name, customer_phone, status, city, vehicle_number, vehicle_make, vehicle_model,
         lead_source, created_at, deleted_at, coupon_meta,
         assigned_telecaller:users_login!assigned_telecaller_id(id, full_name)`,
      )
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })
      .limit(2000);

    // Telecallers: only leads that were assigned to them.
    if (ownOnly) query = query.eq('assigned_telecaller_id', userId);

    if (q) {
      // Search ignores the date window so an old deletion can still be found.
      const digits = q.replace(/\D/g, '');
      const safe = q.replace(/[,()%]/g, ' ').trim();
      const ors = [`customer_name.ilike.%${safe}%`, `lead_number.ilike.%${safe}%`, `vehicle_number.ilike.%${safe}%`];
      if (digits.length >= 4) ors.push(`customer_phone.ilike.%${digits.slice(-10)}%`);
      query = query.or(ors.join(','));
    } else {
      query = query.gte('deleted_at', sinceIso);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const rows = (data || []) as any[];
    const { map: open, mergedInto } = await openLeadsByPhone(
      db,
      rows.map((r) => normalizeCustomerPhone(r.customer_phone) || '').filter(Boolean),
    );

    const leads = rows.map((r) => {
      const meta = r.coupon_meta && typeof r.coupon_meta === 'object' ? r.coupon_meta : {};
      const phone10 = normalizeCustomerPhone(r.customer_phone);
      const active = phone10 ? open.get(phone10) : undefined;
      const merged = r.lead_number ? mergedInto.get(String(r.lead_number)) : undefined;

      // Who / what deleted it. Newer deletions carry a stamp; older ones are inferred.
      let deletedBy: string;
      let deletedKind: 'PANEL' | 'AUTO' | 'UNKNOWN';
      let reason: string | null = meta.deleted_reason || null;
      let mergedIntoNo: string | null = meta.deleted_merged_into || null;
      if (meta.deleted_by_name) {
        deletedBy = String(meta.deleted_by_name);
        deletedKind = meta.deleted_by_role === 'SYSTEM' ? 'AUTO' : 'PANEL';
      } else if (merged) {
        deletedBy = 'System · duplicate merge';
        deletedKind = 'AUTO';
        reason = 'Duplicate of the same phone — merged into the latest lead';
        mergedIntoNo = merged.lead_number || merged.id;
      } else {
        deletedBy = 'Not recorded (old deletion)';
        deletedKind = 'UNKNOWN';
      }

      return {
        id: String(r.id),
        lead_number: r.lead_number || null,
        customer_name: r.customer_name || null,
        customer_phone: r.customer_phone || null,
        vehicle: [r.vehicle_make, r.vehicle_model, r.vehicle_number].filter(Boolean).join(' · ') || null,
        city: r.city || null,
        lead_source: r.lead_source || null,
        status_label: String(meta.last_call_label || r.status || '—'),
        telecaller: r.assigned_telecaller?.full_name || null,
        created_at: r.created_at,
        deleted_at: r.deleted_at,
        deleted_by: deletedBy,
        deleted_by_role: meta.deleted_by_role || null,
        deleted_kind: deletedKind,
        deleted_reason: reason,
        merged_into: mergedIntoNo,
        active_lead: active && active.id !== String(r.id) ? active : null,
      };
    });

    return NextResponse.json({ success: true, total: leads.length, leads, can_restore: !ownOnly });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authorize(request);
    if (!auth.ok) return auth.res;
    const { db, userId, userName } = auth;

    const body = await request.json().catch(() => ({}));
    const id = String(body?.id || '').trim();
    if (!id) return NextResponse.json({ error: 'Lead id required' }, { status: 400 });

    const { data: lead, error: readErr } = await db
      .from('service_leads')
      .select('id, lead_number, customer_phone, status, deleted_at, coupon_meta')
      .eq('id', id)
      .maybeSingle();
    if (readErr) return NextResponse.json({ error: readErr.message }, { status: 400 });
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    if (!lead.deleted_at) return NextResponse.json({ success: true, already: true, lead_number: lead.lead_number });

    const phone10 = normalizeCustomerPhone(lead.customer_phone);
    if (phone10) {
      const { map: open } = await openLeadsByPhone(db, [phone10]);
      const active = open.get(phone10);
      if (active && active.id !== String(lead.id)) {
        return NextResponse.json(
          {
            error: `This number already has an open lead (${active.lead_number || active.id}). Use that lead instead.`,
            active_lead: active,
          },
          { status: 409 },
        );
      }
    }

    const nowIso = new Date().toISOString();
    const meta = appendLeadProfileHistory(lead.coupon_meta as any, {
      at: nowIso,
      summary: `Lead restored by ${userName}`,
      status: String(lead.status || ''),
      event: 'LEAD_RESTORED',
    } as any);
    meta.restored_at = nowIso;
    meta.restored_by_id = userId;
    meta.restored_by_name = userName;

    const { data: updated, error: updErr } = await db
      .from('service_leads')
      .update({ deleted_at: null, updated_at: nowIso, coupon_meta: meta })
      .eq('id', id)
      .select('id, lead_number')
      .maybeSingle();
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 });

    return NextResponse.json({ success: true, lead: updated });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 });
  }
}
