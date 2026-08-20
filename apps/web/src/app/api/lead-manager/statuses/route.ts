import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const CRM_STATUS_COLORS = [
  '#DDD6FE',
  '#BFDBFE',
  '#FECACA',
  '#BBF7D0',
  '#FED7AA',
  '#FBCFE8',
  '#A5F3FC',
  '#FEF08A',
  '#C7D2FE',
  '#99F6E4',
  '#FDE68A',
  '#E9D5FF',
] as const;

export const DEFAULT_LOST_REASONS = [
  'Not Interested',
  'Unqualified Lead',
  'No-Response to Calls',
  'Already Service Done',
  'Under Warranty',
  'Looking For Authorised Service Center',
  'Other Reasons',
] as const;

const MAX_LOST_REASONS = 25;

/** Hardcoded fallback if table not migrated yet */
export const DEFAULT_CRM_STATUSES = [
  {
    code: 'FRESH',
    name: 'Fresh',
    color: '#DBEAFE',
    sort_order: 5,
    is_system: true,
    is_active: true,
    requires_follow_up: false,
    requires_lost_reason: false,
    call_status: 'ANSWERED',
    outcome: 'INFO_COLLECTED',
    pipeline_status: null as string | null,
    stage_group: 'active' as const,
  },
  {
    code: 'INTERESTED',
    name: 'Interested',
    color: '#FFEDD5',
    sort_order: 10,
    is_system: true,
    is_active: true,
    requires_follow_up: false,
    requires_lost_reason: false,
    call_status: 'ANSWERED',
    outcome: 'INFO_COLLECTED',
    pipeline_status: null,
    stage_group: 'active' as const,
  },
  {
    code: 'WILL_VISIT',
    name: 'He will visit',
    color: '#EDE9FE',
    sort_order: 20,
    is_system: true,
    is_active: true,
    requires_follow_up: false,
    requires_lost_reason: false,
    call_status: 'ANSWERED',
    outcome: 'INFO_COLLECTED',
    pipeline_status: null,
    stage_group: 'active' as const,
  },
  {
    code: 'CALLBACK',
    name: 'Follow-up',
    color: '#E0F2FE',
    sort_order: 30,
    is_system: true,
    is_active: true,
    requires_follow_up: true,
    requires_lost_reason: false,
    call_status: 'ANSWERED',
    outcome: 'INFO_COLLECTED',
    pipeline_status: null,
    stage_group: 'active' as const,
  },
  {
    code: 'BOOKING_CONFIRMED',
    name: 'Booking confirmed',
    color: '#D1FAE5',
    sort_order: 40,
    is_system: true,
    is_active: true,
    requires_follow_up: false,
    requires_lost_reason: false,
    call_status: 'ANSWERED',
    outcome: 'LEAD_CREATED',
    pipeline_status: 'VALIDATED',
    stage_group: 'active' as const,
  },
  {
    code: 'IN_SERVICE',
    name: 'In Service',
    color: '#DBEAFE',
    sort_order: 50,
    is_system: true,
    is_active: true,
    requires_follow_up: false,
    requires_lost_reason: false,
    call_status: 'ANSWERED',
    outcome: 'INFO_COLLECTED',
    pipeline_status: 'IN_PROGRESS',
    stage_group: 'active' as const,
  },
  {
    code: 'RINGING',
    name: 'Ringing / No answer',
    color: '#F1F5F9',
    sort_order: 55,
    is_system: true,
    is_active: true,
    requires_follow_up: false,
    requires_lost_reason: false,
    call_status: 'NO_ANSWER',
    outcome: null as string | null,
    pipeline_status: null,
    stage_group: 'active' as const,
  },
  {
    code: 'SERVICE_DONE',
    name: 'Service Done',
    color: '#A7F3D0',
    sort_order: 60,
    is_system: true,
    is_active: true,
    requires_follow_up: false,
    requires_lost_reason: false,
    call_status: 'ANSWERED',
    outcome: 'INFO_COLLECTED',
    pipeline_status: 'COMPLETED',
    stage_group: 'won' as const,
  },
  {
    code: 'LOST',
    name: 'Lost',
    color: '#FEE2E2',
    sort_order: 70,
    is_system: true,
    is_active: true,
    requires_follow_up: false,
    requires_lost_reason: true,
    call_status: 'ANSWERED',
    outcome: 'NOT_INTERESTED',
    pipeline_status: 'REJECTED',
    stage_group: 'lost' as const,
  },
] as const;

function nextAutoColor(existingColors: string[]): string {
  const used = new Set(
    existingColors.map((c) => String(c || '').trim().toUpperCase()).filter(Boolean),
  );
  for (const c of CRM_STATUS_COLORS) {
    if (!used.has(c.toUpperCase())) return c;
  }
  return CRM_STATUS_COLORS[existingColors.length % CRM_STATUS_COLORS.length];
}

function slugCode(name: string): string {
  const base = String(name || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
  return base || 'STATUS';
}

function inferStageGroup(code: string, explicit?: string | null): 'active' | 'won' | 'lost' {
  const g = String(explicit || '').trim().toLowerCase();
  if (g === 'active' || g === 'won' || g === 'lost') return g;
  const c = String(code || '').trim().toUpperCase();
  if (c === 'LOST') return 'lost';
  if (c === 'SERVICE_DONE' || c === 'WON') return 'won';
  return 'active';
}

async function requireCrmUser(request: NextRequest) {
  const supabase = await createClientFromRequest(request);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return { ok: false as const, status: 401, error: 'Unauthorized' };

  const { data: profile } = await supabase
    .from('users_login')
    .select('id, roles!role_id(role_code)')
    .eq('id', user.id)
    .maybeSingle();

  const roleCode = String((profile as { roles?: { role_code?: string } } | null)?.roles?.role_code || '')
    .trim()
    .toUpperCase();

  if (!['LEAD_MANAGER', 'SUPER_ADMIN', 'SUB_ADMIN', 'TELECALLER'].includes(roleCode)) {
    return { ok: false as const, status: 403, error: 'Forbidden' };
  }

  const canManage = ['LEAD_MANAGER', 'SUPER_ADMIN', 'SUB_ADMIN'].includes(roleCode);
  return {
    ok: true as const,
    userId: String((profile as any)?.id || user.id),
    canManage,
    roleCode,
  };
}

async function loadLostReasons(supabaseAdmin: any, includeInactive: boolean) {
  const { data, error } = await supabaseAdmin
    .from('crm_lost_reasons')
    .select('id, name, sort_order, is_active, created_at')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    return {
      reasons: DEFAULT_LOST_REASONS.map((name, i) => ({
        id: `fallback-lr-${i}`,
        name,
        sort_order: (i + 1) * 10,
        is_active: true,
      })),
      warning: 'Run database/323_crm_lead_status_stages_lost_reasons.sql',
    };
  }

  let rows = data || [];
  if (!includeInactive) rows = rows.filter((r: any) => r.is_active !== false);
  return { reasons: rows, warning: null as string | null };
}

/** GET statuses + lost reasons */
export async function GET(request: NextRequest) {
  const gate = await requireCrmUser(request);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return NextResponse.json({ error: 'Admin unavailable' }, { status: 500 });

  const includeAll = request.nextUrl.searchParams.get('all') === '1' && gate.canManage;

  const { data, error } = await supabaseAdmin
    .from('crm_lead_statuses')
    .select(
      'id, code, name, color, sort_order, is_system, is_active, requires_follow_up, requires_lost_reason, call_status, outcome, pipeline_status, stage_group, created_at',
    )
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  const lostPack = await loadLostReasons(supabaseAdmin, includeAll);

  if (error) {
    return NextResponse.json({
      statuses: DEFAULT_CRM_STATUSES.map((s, i) => ({ id: `fallback-${i}`, ...s })),
      lost_reasons: lostPack.reasons,
      warning: 'Run database/322_crm_lead_statuses.sql and database/323_crm_lead_status_stages_lost_reasons.sql',
      palette: [...CRM_STATUS_COLORS],
      max_lost_reasons: MAX_LOST_REASONS,
    });
  }

  let rows = (data || []).map((r: any) => ({
    ...r,
    stage_group: inferStageGroup(r.code, r.stage_group),
  }));
  if (!includeAll) {
    rows = rows.filter((r: any) => r.is_active !== false);
  }

  const warnings = [lostPack.warning].filter(Boolean);
  return NextResponse.json({
    statuses: rows,
    lost_reasons: lostPack.reasons,
    warning: warnings[0] || null,
    palette: [...CRM_STATUS_COLORS],
    max_lost_reasons: MAX_LOST_REASONS,
  });
}

/** POST create / update / delete status + lost reasons */
export async function POST(request: NextRequest) {
  const gate = await requireCrmUser(request);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  if (!gate.canManage) {
    return NextResponse.json({ error: 'Only managers/admins can manage statuses' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const action = String(body?.action || 'create_status').trim();

  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return NextResponse.json({ error: 'Admin unavailable' }, { status: 500 });

  if (action === 'create_status') {
    const name = String(body?.name || '').trim();
    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });

    const { data: existingRows } = await supabaseAdmin
      .from('crm_lead_statuses')
      .select('id, name, code, color, sort_order');

    const dupName = (existingRows || []).find(
      (r: any) => String(r.name || '').trim().toLowerCase() === name.toLowerCase(),
    );
    if (dupName) {
      return NextResponse.json(
        {
          error: `Status already exists as "${dupName.name}" (case-insensitive). Use edit instead.`,
          existing: dupName,
        },
        { status: 409 },
      );
    }

    let code = String(body?.code || '').trim().toUpperCase() || slugCode(name);
    const codes = new Set(
      (existingRows || []).map((r: any) => String(r.code || '').trim().toUpperCase()),
    );
    if (codes.has(code)) {
      let n = 2;
      while (codes.has(`${code}_${n}`)) n += 1;
      code = `${code}_${n}`;
    }

    const autoColor = nextAutoColor((existingRows || []).map((r: any) => String(r.color || '')));
    const color =
      body?.auto_color === false && String(body?.color || '').trim()
        ? String(body.color).trim()
        : autoColor;

    const stage_group = inferStageGroup(code, body?.stage_group || 'active');
    const maxSort = (existingRows || []).reduce(
      (m: number, r: any) => Math.max(m, Number(r.sort_order) || 0),
      0,
    );

    const requires_follow_up = Boolean(body?.requires_follow_up);
    const requires_lost_reason =
      Boolean(body?.requires_lost_reason) || stage_group === 'lost';
    const call_status = String(body?.call_status || 'ANSWERED').trim().toUpperCase() || 'ANSWERED';
    const outcome =
      body?.outcome != null && String(body.outcome).trim()
        ? String(body.outcome).trim().toUpperCase()
        : requires_lost_reason
          ? 'NOT_INTERESTED'
          : 'INFO_COLLECTED';
    const pipeline_status =
      body?.pipeline_status != null && String(body.pipeline_status).trim()
        ? String(body.pipeline_status).trim().toUpperCase()
        : stage_group === 'won'
          ? 'COMPLETED'
          : requires_lost_reason
            ? 'REJECTED'
            : null;

    const { data, error } = await supabaseAdmin
      .from('crm_lead_statuses')
      .insert({
        code,
        name,
        color,
        sort_order: maxSort + 10,
        is_system: false,
        is_active: true,
        requires_follow_up,
        requires_lost_reason,
        call_status,
        outcome,
        pipeline_status,
        stage_group,
        created_by: gate.userId,
      })
      .select(
        'id, code, name, color, sort_order, is_system, is_active, requires_follow_up, requires_lost_reason, call_status, outcome, pipeline_status, stage_group',
      )
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, status: data });
  }

  if (action === 'update_status') {
    const id = String(body?.id || '').trim();
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const { data: row } = await supabaseAdmin
      .from('crm_lead_statuses')
      .select('id, code, is_system')
      .eq('id', id)
      .maybeSingle();
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (body?.name != null) {
      const name = String(body.name).trim();
      if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });
      const { data: existingRows } = await supabaseAdmin.from('crm_lead_statuses').select('id, name');
      const dup = (existingRows || []).find(
        (r: any) =>
          String(r.id) !== id && String(r.name || '').trim().toLowerCase() === name.toLowerCase(),
      );
      if (dup) {
        return NextResponse.json(
          {
            error: `Another status already exists as "${dup.name}" (case-insensitive).`,
            existing: dup,
          },
          { status: 409 },
        );
      }
      patch.name = name;
    }

    if (body?.color != null && String(body.color).trim()) {
      patch.color = String(body.color).trim();
    }
    if (body?.sort_order != null && Number.isFinite(Number(body.sort_order))) {
      patch.sort_order = Number(body.sort_order);
    }
    if (body?.is_active != null) {
      patch.is_active = Boolean(body.is_active);
    }
    if (body?.stage_group != null) {
      patch.stage_group = inferStageGroup(String(row.code), body.stage_group);
    }
    if (body?.requires_follow_up != null) {
      patch.requires_follow_up = Boolean(body.requires_follow_up);
    }
    if (body?.requires_lost_reason != null) {
      patch.requires_lost_reason = Boolean(body.requires_lost_reason);
    }
    if (body?.call_status != null && String(body.call_status).trim()) {
      patch.call_status = String(body.call_status).trim().toUpperCase();
    }
    if (body?.outcome !== undefined) {
      patch.outcome = body.outcome ? String(body.outcome).trim().toUpperCase() : null;
    }
    if (body?.pipeline_status !== undefined) {
      patch.pipeline_status = body.pipeline_status
        ? String(body.pipeline_status).trim().toUpperCase()
        : null;
    }

    if (!row.is_system && body?.code != null && String(body.code).trim()) {
      const code = String(body.code).trim().toUpperCase();
      const { data: existingRows } = await supabaseAdmin.from('crm_lead_statuses').select('id, code');
      const dup = (existingRows || []).find(
        (r: any) =>
          String(r.id) !== id && String(r.code || '').trim().toUpperCase() === code,
      );
      if (dup) {
        return NextResponse.json({ error: `Code "${code}" already used` }, { status: 409 });
      }
      patch.code = code;
    }

    const { data, error } = await supabaseAdmin
      .from('crm_lead_statuses')
      .update(patch)
      .eq('id', id)
      .select(
        'id, code, name, color, sort_order, is_system, is_active, requires_follow_up, requires_lost_reason, call_status, outcome, pipeline_status, stage_group',
      )
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, status: data });
  }

  if (action === 'delete_status') {
    const id = String(body?.id || '').trim();
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const { data: row } = await supabaseAdmin
      .from('crm_lead_statuses')
      .select('id, is_system, name')
      .eq('id', id)
      .maybeSingle();
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // System → soft deactivate (TeleCRM-style trash still works)
    if (row.is_system) {
      const { error } = await supabaseAdmin
        .from('crm_lead_statuses')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, deactivated: id });
    }

    const { error } = await supabaseAdmin.from('crm_lead_statuses').delete().eq('id', id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, deleted: id });
  }

  if (action === 'create_lost_reason') {
    const name = String(body?.name || '').trim();
    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });

    const { data: existing } = await supabaseAdmin.from('crm_lost_reasons').select('id, name');
    if ((existing || []).length >= MAX_LOST_REASONS) {
      return NextResponse.json(
        { error: `Max ${MAX_LOST_REASONS} lost reasons allowed` },
        { status: 400 },
      );
    }
    const dup = (existing || []).find(
      (r: any) => String(r.name || '').trim().toLowerCase() === name.toLowerCase(),
    );
    if (dup) {
      return NextResponse.json(
        { error: `Lost reason already exists as "${dup.name}"` },
        { status: 409 },
      );
    }

    const maxSort = (existing || []).length * 10;
    const { data, error } = await supabaseAdmin
      .from('crm_lost_reasons')
      .insert({
        name,
        sort_order: maxSort + 10,
        is_active: true,
        created_by: gate.userId,
      })
      .select('id, name, sort_order, is_active')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, reason: data });
  }

  if (action === 'update_lost_reason') {
    const id = String(body?.id || '').trim();
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body?.name != null) {
      const name = String(body.name).trim();
      if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });
      const { data: existing } = await supabaseAdmin.from('crm_lost_reasons').select('id, name');
      const dup = (existing || []).find(
        (r: any) =>
          String(r.id) !== id && String(r.name || '').trim().toLowerCase() === name.toLowerCase(),
      );
      if (dup) {
        return NextResponse.json(
          { error: `Another reason already exists as "${dup.name}"` },
          { status: 409 },
        );
      }
      patch.name = name;
    }
    if (body?.sort_order != null && Number.isFinite(Number(body.sort_order))) {
      patch.sort_order = Number(body.sort_order);
    }
    if (body?.is_active != null) patch.is_active = Boolean(body.is_active);

    const { data, error } = await supabaseAdmin
      .from('crm_lost_reasons')
      .update(patch)
      .eq('id', id)
      .select('id, name, sort_order, is_active')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, reason: data });
  }

  if (action === 'delete_lost_reason') {
    const id = String(body?.id || '').trim();
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const { error } = await supabaseAdmin.from('crm_lost_reasons').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, deleted: id });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
