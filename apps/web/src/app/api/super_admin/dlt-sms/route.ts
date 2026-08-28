import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import {
  deleteById,
  getDltSnapshot,
  listLogs,
  saveDltEntity,
  upsertCta,
  upsertHeader,
  upsertTelemarketer,
  upsertTemplate,
} from '@/lib/dlt-sms/store';
import { sendDltSms } from '@/lib/dlt-sms/send';
import { DLT_OPERATORS } from '@/lib/dlt-sms/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

async function requireAdmin(request: NextRequest) {
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

  const roleCode = String((profile as any)?.roles?.role_code || '')
    .trim()
    .toUpperCase();
  if (!['SUPER_ADMIN', 'SUB_ADMIN'].includes(roleCode)) {
    return { ok: false as const, status: 403, error: 'Forbidden' };
  }
  return { ok: true as const, userId: String((profile as any)?.id || user.id), roleCode };
}

export async function GET(request: NextRequest) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  try {
    const snapshot = await getDltSnapshot(50);
    return NextResponse.json({
      success: true,
      ...snapshot,
      operators: DLT_OPERATORS,
      jioPortal: 'https://trueconnect.jio.com',
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to load DLT SMS' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  if (gate.roleCode !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Only Super Admin can edit DLT SMS' }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || '').trim();

    if (action === 'save_entity') {
      const entity = await saveDltEntity(body.entity || body, gate.userId);
      return NextResponse.json({ success: true, entity });
    }

    if (action === 'upsert_header') {
      const header = await upsertHeader(body, gate.userId);
      return NextResponse.json({ success: true, header });
    }

    if (action === 'delete_header') {
      await deleteById('dlt_sms_headers', String(body.id || ''));
      return NextResponse.json({ success: true });
    }

    if (action === 'upsert_template') {
      const template = await upsertTemplate(body, gate.userId);
      return NextResponse.json({ success: true, template });
    }

    if (action === 'delete_template') {
      await deleteById('dlt_sms_templates', String(body.id || ''));
      return NextResponse.json({ success: true });
    }

    if (action === 'upsert_telemarketer') {
      const telemarketer = await upsertTelemarketer(body, gate.userId);
      return NextResponse.json({ success: true, telemarketer });
    }

    if (action === 'delete_telemarketer') {
      await deleteById('dlt_sms_telemarketers', String(body.id || ''));
      return NextResponse.json({ success: true });
    }

    if (action === 'upsert_cta') {
      const cta = await upsertCta(body, gate.userId);
      return NextResponse.json({ success: true, cta });
    }

    if (action === 'delete_cta') {
      await deleteById('dlt_sms_cta', String(body.id || ''));
      return NextResponse.json({ success: true });
    }

    if (action === 'send') {
      const result = await sendDltSms({
        phone: String(body.phone || ''),
        templateId: body.templateId ? String(body.templateId) : undefined,
        eventKey: body.eventKey ? String(body.eventKey) : undefined,
        vars: body.vars && typeof body.vars === 'object' ? body.vars : {},
        createdBy: gate.userId,
      });
      return NextResponse.json({ success: result.ok, ...result }, { status: result.ok ? 200 : 400 });
    }

    if (action === 'logs') {
      const logs = await listLogs(Number(body.limit) || 80);
      return NextResponse.json({ success: true, logs });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'DLT SMS update failed' }, { status: 500 });
  }
}
