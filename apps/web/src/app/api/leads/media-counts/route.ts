import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import type { Database } from '@/types/database';
import type { PostgrestError } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

type RoleCode =
  | 'SUPER_ADMIN'
  | 'SUB_ADMIN'
  | 'WORKSHOP_ADMIN'
  | 'WORKSHOP_SUPERVISOR'
  | 'WORKSHOP_MECHANIC'
  | 'WORKSHOP_PICKUP_BOY';

async function getAuthedProfile(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { user: null, profile: null, roleCode: null as string | null, error: 'Unauthorized' };

  const email = (user.email || '').trim();
  const phone = (user.phone || '').trim();
  const selectProfile = 'id, email, phone, workshop_id, roles!inner(role_code)';

  const { data: byEmail } = email
    ? await supabase.from('users_login').select(selectProfile).ilike('email', email).maybeSingle()
    : { data: null };
  const { data: byPhone } = !byEmail && phone
    ? await supabase.from('users_login').select(selectProfile).eq('phone', phone).maybeSingle()
    : { data: null };
  const { data: byId } = !byEmail && !byPhone
    ? await supabase.from('users_login').select(selectProfile).eq('id', user.id).maybeSingle()
    : { data: null };

  const profile = byEmail || byPhone || byId;
  const roleCode = (profile?.roles as any)?.role_code || null;
  return { user, profile, roleCode, error: profile ? null : 'User profile not found' };
}

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!serviceRoleKey) {
    return { supabaseAdmin: null, error: 'Server configuration error: SUPABASE_SERVICE_ROLE_KEY not set' };
  }
  const supabaseAdmin = createSupabaseAdminClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { supabaseAdmin, error: null };
}

const REQUIRED_PICKUP_VISIT_TYPES = [
  'BEFORE_FRONT',
  'BEFORE_REAR',
  'BEFORE_LEFT',
  'BEFORE_RIGHT',
  'BEFORE_DASHBOARD',
  'BEFORE_ENGINE_BAY',
] as const;

function inferSlot(row: any): string {
  const t = String(row?.photo_type || row?.category || '').toUpperCase().trim();
  if (t.startsWith('BEFORE_')) return t;
  const fn = String(row?.file_name || '').toUpperCase();
  const m = fn.match(/^(BEFORE_[A-Z0-9_]+)__+/);
  if (m?.[1]) return (m[1] || '').toUpperCase();
  const url = String(row?.file_url || row?.photo_url || '');
  const mu = url.match(/(BEFORE_[A-Z0-9_]+)_\d{4,}/);
  if (mu?.[1]) return (mu[1] || '').toUpperCase();
  return '';
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { supabaseAdmin, error: adminError } = getAdminClient();
    if (!supabaseAdmin) {
      console.error('[media-counts] admin client missing:', adminError);
      return NextResponse.json({ error: adminError }, { status: 500 });
    }

    const { profile, roleCode, error } = await getAuthedProfile(supabase);
    if (error === 'Unauthorized') {
      console.warn('[media-counts] unauthorized');
      return NextResponse.json({ error }, { status: 401 });
    }
    if (!profile) {
      console.warn('[media-counts] profile not found');
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const leadIdsRaw = Array.isArray(body?.lead_ids) ? body.lead_ids : [];
    const leadIds = leadIdsRaw.map((x: any) => String(x || '').trim()).filter(Boolean);
    if (!leadIds.length) return NextResponse.json({ error: 'lead_ids required' }, { status: 400 });

    const rc = (roleCode as RoleCode | null) || null;
    const isPrivileged = rc === 'SUPER_ADMIN' || rc === 'SUB_ADMIN';

    // Enforce access: for non-privileged users, restrict lead_ids to those they can see.
    let allowedLeadIds = leadIds;
    if (!isPrivileged) {
      if (rc === 'WORKSHOP_ADMIN' || rc === 'WORKSHOP_SUPERVISOR') {
        // Same workshop
        const { data: leads } = (await supabaseAdmin
          .from('service_leads')
          .select('id, workshop_id')
          .in('id', leadIds)) as any;
        allowedLeadIds = (leads || [])
          .filter((l: any) => String(l.workshop_id || '') === String(profile.workshop_id || ''))
          .map((l: any) => String(l.id));
      } else if (rc === 'WORKSHOP_MECHANIC') {
        const { data: leads } = (await supabaseAdmin
          .from('service_leads')
          .select('id, assigned_mechanic_id')
          .in('id', leadIds)) as any;
        allowedLeadIds = (leads || [])
          .filter((l: any) => String(l.assigned_mechanic_id || '') === String(profile.id || ''))
          .map((l: any) => String(l.id));
      } else if (rc === 'WORKSHOP_PICKUP_BOY') {
        const { data: leads } = (await supabaseAdmin
          .from('service_leads')
          .select('id, assigned_pickup_boy_id')
          .in('id', leadIds)) as any;
        allowedLeadIds = (leads || [])
          .filter((l: any) => String(l.assigned_pickup_boy_id || '') === String(profile.id || ''))
          .map((l: any) => String(l.id));
      } else {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    if (!allowedLeadIds.length) {
      return NextResponse.json({ success: true, counts: {} }, { status: 200 });
    }

    // lead_media schema varies across installs. Be tolerant to missing columns.
    let mediaRows: any[] = [];
    let mediaError: PostgrestError | null = null;
    const selects = [
      // most complete
      'lead_id, photo_type, category, file_name, file_url, photo_url',
      // file_url may not exist in some schemas
      'lead_id, photo_type, category, file_name, photo_url',
      // photo_url may not exist in some schemas
      'lead_id, photo_type, category, file_name, file_url',
      // without photo_type
      'lead_id, category, file_name, photo_url',
      'lead_id, category, file_name, file_url',
      // minimal
      'lead_id, file_name, photo_url',
      'lead_id, file_name, file_url',
    ];

    for (const sel of selects) {
      const attempt = (await supabaseAdmin
        .from('lead_media')
        .select(sel)
        .in('lead_id', allowedLeadIds)
        .limit(5000)) as { data: any[] | null; error: PostgrestError | null };

      if (!attempt.error) {
        mediaRows = attempt.data || [];
        mediaError = null;
        break;
      }

      mediaError = attempt.error;
      // Retry only for missing-column errors
      if ((attempt.error as any)?.code !== '42703') break;
    }

    if (mediaError) {
      console.error('[media-counts] lead_media fetch error:', mediaError);
      return NextResponse.json({ error: 'Failed to fetch media', details: mediaError.message }, { status: 500 });
    }

    const byLead = new Map<string, Set<string>>();
    for (const row of mediaRows || []) {
      const leadId = String((row as any)?.lead_id || '').trim();
      if (!leadId) continue;

      // IMPORTANT: don't rely on photo_category/category columns (schema varies).
      // Infer slot from (photo_type/category/file_name/url) and treat BEFORE_* as Pickup/Visit.
      const slot = inferSlot(row);
      if (!slot || !slot.startsWith('BEFORE_')) continue;

      if (!byLead.has(leadId)) byLead.set(leadId, new Set<string>());
      byLead.get(leadId)!.add(slot);
    }

    const counts: Record<string, { required_uploaded: number; required_total: number }> = {};
    for (const id of allowedLeadIds) {
      const set = byLead.get(id) || new Set<string>();
      const requiredUploaded = REQUIRED_PICKUP_VISIT_TYPES.filter((t) => set.has(t)).length;
      counts[id] = { required_uploaded: requiredUploaded, required_total: REQUIRED_PICKUP_VISIT_TYPES.length };
    }

    return NextResponse.json({ success: true, counts }, { status: 200 });
  } catch (e: any) {
    console.error('[media-counts] internal error:', e);
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}

