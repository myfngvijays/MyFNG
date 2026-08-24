import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';
import { mergePlaybook, defaultSalesPlaybook } from '@/lib/telecaller/salesPlaybookDefaults';
import { loadSalesPlaybook } from '@/lib/telecaller/loadSalesPlaybook';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function assertEditor(request: NextRequest) {
  const supabase = await createClientFromRequest(request);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return { ok: false as const, status: 401, error: 'Unauthorized', db: null as any, userId: null as string | null };
  }
  const profile = await resolveUserProfile(supabase, user);
  const roleCode = String((profile?.roles as any)?.role_code || '')
    .trim()
    .toUpperCase();
  if (!['SUPER_ADMIN', 'SUB_ADMIN', 'LEAD_MANAGER'].includes(roleCode)) {
    return { ok: false as const, status: 403, error: 'Forbidden', db: null as any, userId: null };
  }
  const { supabaseAdmin } = getSupabaseAdmin();
  return {
    ok: true as const,
    status: 200,
    error: null,
    db: supabaseAdmin ?? supabase,
    userId: String((profile as any)?.id || user.id),
    roleCode,
  };
}

export async function GET(request: NextRequest) {
  const auth = await assertEditor(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const playbook = await loadSalesPlaybook(auth.db);
    return NextResponse.json({ success: true, playbook });
  } catch (e: any) {
    return NextResponse.json({ success: true, playbook: defaultSalesPlaybook(), warning: e?.message });
  }
}

export async function PUT(request: NextRequest) {
  const auth = await assertEditor(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = await request.json().catch(() => ({}));
  const existing = await loadSalesPlaybook(auth.db);
  const incomingWf = body.call_iq_workflow;
  const call_iq_workflow =
    incomingWf && typeof incomingWf === 'object'
      ? incomingWf
      : existing.call_iq_workflow;
  const next = mergePlaybook({
    workspace_key: 'myfng',
    detail_depth: body.detail_depth,
    language: body.language,
    voice_style: body.voice_style,
    icp: body.icp,
    product_features: body.product_features,
    pricing: body.pricing,
    objection_handling: body.objection_handling,
    competitors: body.competitors,
    call_iq_prompt: body.call_iq_prompt,
    lead_iq_prompt: body.lead_iq_prompt,
    call_iq_enabled: body.call_iq_enabled,
    lead_iq_enabled: body.lead_iq_enabled,
    call_iq_workflow,
  });

  const payload = {
    workspace_key: 'myfng',
    detail_depth: next.detail_depth,
    language: next.language,
    voice_style: next.voice_style,
    icp: next.icp,
    product_features: next.product_features,
    pricing: next.pricing,
    objection_handling: next.objection_handling,
    competitors: next.competitors,
    call_iq_prompt: next.call_iq_prompt,
    lead_iq_prompt: next.lead_iq_prompt,
    call_iq_enabled: next.call_iq_enabled,
    lead_iq_enabled: next.lead_iq_enabled,
    call_iq_workflow: next.call_iq_workflow,
    updated_by: auth.userId,
    updated_at: new Date().toISOString(),
  };

  let { error } = await auth.db.from('ai_sales_playbook').upsert(payload, {
    onConflict: 'workspace_key',
  });
  if (error && /call_iq_workflow/i.test(error.message || '')) {
    const { call_iq_workflow, ...rest } = payload;
    const retry = await auth.db.from('ai_sales_playbook').upsert(rest, { onConflict: 'workspace_key' });
    error = retry.error;
    if (!error) {
      return NextResponse.json({
        success: true,
        playbook: next,
        warning: 'Run database/349_call_iq_workflow.sql to persist flowchart settings',
      });
    }
  }
  if (error) {
    if (/does not exist|schema cache|PGRST205|42P01/i.test(error.message || '')) {
      return NextResponse.json(
        { error: 'Run database/348_ai_suite_call_lead_iq.sql', playbook: next },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true, playbook: next });
}
