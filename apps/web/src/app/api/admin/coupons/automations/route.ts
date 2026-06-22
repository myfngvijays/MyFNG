import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { logCouponAudit } from '@/lib/coupon-rules';
import { COUPON_AUTOMATION_TEMPLATES } from '@/lib/coupon-automation-templates';

async function requireSuperAdmin(request: NextRequest) {
  const supabase = await createClientFromRequest(request);
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { ok: false as const, status: 401, error: 'Unauthorized' };

  const { data: userProfile, error: profileError } = await supabase
    .from('users_login')
    .select('role:roles!role_id(role_code)')
    .eq('id', user.id)
    .single();

  const roleCode = (userProfile?.role as any)?.role_code;
  if (profileError || roleCode !== 'SUPER_ADMIN') {
    return { ok: false as const, status: 403, error: 'Forbidden' };
  }

  return { ok: true as const, userId: user.id };
}

export async function GET(request: NextRequest) {
  try {
    const gate = await requireSuperAdmin(request);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) return NextResponse.json({ error: adminError }, { status: 500 });

    const { data: automations, error } = await supabaseAdmin
      .from('coupon_automations')
      .select('*, coupon:coupons(id, code, campaign_name, is_active)')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      if (String(error.message || '').includes('coupon_automations')) {
        return NextResponse.json({
          automations: [],
          runs: [],
          templates: COUPON_AUTOMATION_TEMPLATES,
          migration_required: true,
          summary: { total: 0, active: 0, total_runs: 0 },
        });
      }
      throw error;
    }

    const { data: runs } = await supabaseAdmin
      .from('coupon_automation_runs')
      .select('id, automation_id, customer_phone, status, message, created_at, automation:coupon_automations(name, trigger_type)')
      .order('created_at', { ascending: false })
      .limit(50);

    const list = automations || [];
    const active = list.filter((a: any) => a.is_active).length;
    const totalRuns = list.reduce((sum: number, a: any) => sum + Number(a.run_count || 0), 0);

    const usedTemplateKeys = new Set(list.map((a: any) => a.template_key).filter(Boolean));
    const templates = COUPON_AUTOMATION_TEMPLATES.map((t) => ({
      ...t,
      already_used: usedTemplateKeys.has(t.key),
    }));

    return NextResponse.json({
      automations: list,
      runs: runs || [],
      templates,
      migration_required: false,
      summary: {
        total: list.length,
        active,
        total_runs: totalRuns,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const gate = await requireSuperAdmin(request);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) return NextResponse.json({ error: adminError }, { status: 500 });

    const body = await request.json().catch(() => ({}));
    const templateKey = String(body?.template_key || '').trim();

    let payload: Record<string, unknown> = {
      name: String(body?.name || '').trim(),
      description: body?.description ? String(body.description).trim() : null,
      trigger_type: String(body?.trigger_type || '').trim(),
      action_type: String(body?.action_type || 'ASSIGN_COUPON').trim(),
      conditions: body?.conditions && typeof body.conditions === 'object' ? body.conditions : {},
      coupon_id: body?.coupon_id || null,
      is_active: body?.is_active !== false,
      priority: Number(body?.priority || 0),
      template_key: templateKey || null,
      created_by: gate.userId,
    };

    if (templateKey) {
      const template = COUPON_AUTOMATION_TEMPLATES.find((t) => t.key === templateKey);
      if (!template) return NextResponse.json({ error: 'Unknown template' }, { status: 400 });
      const customConditions =
        body?.conditions && typeof body.conditions === 'object' ? body.conditions : {};
      payload = {
        ...payload,
        name: payload.name || template.name,
        description: payload.description || template.description,
        trigger_type: template.trigger_type,
        action_type: template.action_type,
        conditions: { ...template.conditions, ...customConditions },
        coupon_id: body?.coupon_id || null,
        template_key: templateKey,
      };
    } else if (body?.conditions && typeof body.conditions === 'object') {
      payload.conditions = body.conditions;
    }

    if (!payload.name || !payload.trigger_type || !payload.action_type) {
      return NextResponse.json({ error: 'name, trigger_type and action_type are required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('coupon_automations')
      .insert([payload])
      .select('*, coupon:coupons(id, code, campaign_name, is_active)')
      .single();

    if (error) throw error;

    await logCouponAudit(supabaseAdmin, {
      action: 'automation_created',
      actor_user_id: gate.userId,
      details: { automation_id: data.id, name: data.name, trigger_type: data.trigger_type },
    });

    return NextResponse.json({ automation: data }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
