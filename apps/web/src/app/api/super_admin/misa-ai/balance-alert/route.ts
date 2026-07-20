import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getOpenAiCreditBalanceStatus,
  runOpenAiCreditBalanceAlert,
  saveOpenAiCreditBalanceSettings,
} from '@/lib/chatbot_v2/openAiCreditBalance';
import {
  createOpenAiBalanceAlertTemplate,
  getOpenAiBalanceAlertTemplateStatus,
  OPENAI_BALANCE_ALERT_TEMPLATE,
  syncOpenAiBalanceAlertTemplate,
} from '@/lib/services/openAiBalanceAlertTemplate';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function assertSuperAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) return { ok: false as const, status: 401, error: 'Unauthorized' };

  const { data: userData, error: roleError } = await supabase
    .from('users_login')
    .select('id, roles!inner(role_code)')
    .eq('id', user.id)
    .single();

  if (roleError || !userData) return { ok: false as const, status: 403, error: 'Forbidden' };

  const roleCode = (userData as { roles?: { role_code?: string } }).roles?.role_code;
  if (!['SUPER_ADMIN', 'SUB_ADMIN'].includes(String(roleCode || ''))) {
    return { ok: false as const, status: 403, error: 'Forbidden' };
  }

  return { ok: true as const, userId: userData.id as string };
}

export async function GET() {
  try {
    const auth = await assertSuperAdmin();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const status = await getOpenAiCreditBalanceStatus();
    const templateStatus = await getOpenAiBalanceAlertTemplateStatus();
    return NextResponse.json({
      success: true,
      ...status,
      template_status: templateStatus,
      template_preview: OPENAI_BALANCE_ALERT_TEMPLATE,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await assertSuperAdmin();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await request.json();
    const settings = await saveOpenAiCreditBalanceSettings({
      baseline_usd: body.baseline_usd !== undefined ? Number(body.baseline_usd) : undefined,
      alert_threshold_usd:
        body.alert_threshold_usd !== undefined ? Number(body.alert_threshold_usd) : undefined,
      alert_enabled: body.alert_enabled !== undefined ? Boolean(body.alert_enabled) : undefined,
      reset_baseline: Boolean(body.reset_baseline),
    });
    const status = await getOpenAiCreditBalanceStatus();

    return NextResponse.json({ success: true, settings, ...status });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await assertSuperAdmin();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await request.json();
    const action = String(body.action || '');

    if (action === 'create-template') {
      const result = await createOpenAiBalanceAlertTemplate(auth.userId);
      const templateStatus = await getOpenAiBalanceAlertTemplateStatus();
      return NextResponse.json({ success: true, ...result, template_status: templateStatus });
    }

    if (action === 'sync-template') {
      const result = await syncOpenAiBalanceAlertTemplate(auth.userId);
      const templateStatus = await getOpenAiBalanceAlertTemplateStatus();
      return NextResponse.json({ success: true, ...result, template_status: templateStatus });
    }

    if (action === 'test-alert') {
      const result = await runOpenAiCreditBalanceAlert({ test: true });
      const allSuccess = result.sent > 0 && result.results.every((row) => row.success);
      return NextResponse.json({
        success: allSuccess,
        message: allSuccess
          ? `Test alert sent via ${result.deliveryMode || 'whatsapp'} to ${result.sent} number(s)`
          : result.reason || 'Test alert failed — see results for details',
        ...result,
      });
    }

    if (action === 'check-now') {
      const result = await runOpenAiCreditBalanceAlert({ force: false });
      return NextResponse.json({ success: true, ...result });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
