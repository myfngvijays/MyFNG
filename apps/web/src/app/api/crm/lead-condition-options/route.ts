import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';

export const dynamic = 'force-dynamic';

const ALLOWED = new Set(['TELECALLER', 'LEAD_MANAGER', 'SUPER_ADMIN', 'SUB_ADMIN', 'APP_OPERATIONS']);

type Opt = { value: string; label: string };

/**
 * Dropdown values for the Leads list "+ Add condition" builder.
 * GET /api/crm/lead-condition-options
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
    const { supabaseAdmin } = getSupabaseAdmin();
    const db: any = supabaseAdmin ?? supabase;

    const [people, workshops, tags, statuses, lost, templates, recent] = await Promise.all([
      db
        .from('users_login')
        .select('id, full_name, is_active, roles!inner(role_code)')
        .in('roles.role_code', ['TELECALLER', 'LEAD_MANAGER', 'SUPER_ADMIN', 'SUB_ADMIN'])
        .eq('is_active', true)
        .order('full_name'),
      db.from('workshops').select('id, name, is_active').order('name').limit(1000),
      db.from('crm_lead_tags').select('id, name').order('name').limit(500),
      db.from('crm_lead_statuses').select('code, name, is_active, sort_order').order('sort_order'),
      db.from('crm_lost_reasons').select('name, is_active, sort_order').order('sort_order'),
      db.from('crm_api_templates').select('id, name').is('deleted_at', null).order('name'),
      db
        .from('service_leads')
        .select('city, lead_source, coupon_meta->>vehicle_class, coupon_meta->>message_trigger_label, coupon_meta->>telecrm_status, coupon_meta->>last_other_reason')
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })
        .limit(6000),
    ]);

    const distinct = (key: string): Opt[] => {
      const seen = new Map<string, string>();
      for (const row of (recent.data || []) as any[]) {
        const raw = String(row?.[key] ?? '').trim();
        if (!raw) continue;
        const k = raw.toLowerCase();
        if (!seen.has(k)) seen.set(k, raw);
      }
      return Array.from(seen.values())
        .sort((a, b) => a.localeCompare(b))
        .map((v) => ({ value: v, label: v }));
    };

    const statusOpts: Opt[] = [];
    const seenStatus = new Set<string>();
    for (const row of (statuses.data || []) as any[]) {
      const code = String(row.code || '').trim().toUpperCase();
      if (!code || row.is_active === false || seenStatus.has(code)) continue;
      seenStatus.add(code);
      statusOpts.push({ value: code, label: String(row.name || code) });
    }

    return NextResponse.json({
      success: true,
      options: {
        telecallers: ((people.data || []) as any[]).map((p) => ({
          value: String(p.id),
          label: String(p.full_name || 'Unnamed'),
        })),
        workshops: ((workshops.data || []) as any[])
          .filter((w) => w.is_active !== false)
          .map((w) => ({ value: String(w.id), label: String(w.name || 'Workshop') })),
        tags: ((tags.data || []) as any[]).map((t) => ({ value: String(t.id), label: String(t.name || 'Tag') })),
        statuses: statusOpts,
        lost_reasons: ((lost.data || []) as any[])
          .filter((r) => r.is_active !== false && r.name)
          .map((r) => ({ value: String(r.name), label: String(r.name) })),
        other_reasons: distinct('last_other_reason'),
        cities: distinct('city'),
        sources: distinct('lead_source'),
        vehicle_classes: distinct('vehicle_class'),
        triggers: distinct('message_trigger_label'),
        telecrm_statuses: distinct('telecrm_status'),
        api_templates: ((templates.data || []) as any[]).map((t) => ({ value: String(t.id), label: String(t.name) })),
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 });
  }
}
