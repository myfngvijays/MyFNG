import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const ALLOWED_ADMIN_ROLES = ['SUPER_ADMIN', 'SUB_ADMIN'];

function getRangeStart(range: string) {
  const now = Date.now();
  if (range === '24h') return new Date(now - 24 * 60 * 60 * 1000).toISOString();
  if (range === '30d') return new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
  return new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
}

async function assertAdmin(db: any) {
  const {
    data: { user },
    error: authError,
  } = await db.auth.getUser();
  if (authError || !user) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }

  const { data: userProfile } = await db
    .from('users_login')
    .select('id, roles!inner(role_code)')
    .eq('id', user.id)
    .maybeSingle();

  const roleCode = (userProfile as any)?.roles?.role_code;
  if (!userProfile || !ALLOWED_ADMIN_ROLES.includes(roleCode)) {
    return { ok: false, status: 403, error: 'Forbidden' };
  }
  return { ok: true, status: 200, error: null };
}

export async function GET(request: NextRequest) {
  try {
    const range = String(request.nextUrl.searchParams.get('range') || '7d');
    const fromIso = getRangeStart(range);

    const supabase = await createClient();
    const db: any = supabase;
    const auth = await assertAdmin(db);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { data: messageRows, error: messageError } = await db
      .from('whatsapp_messages')
      .select('status, template_name, created_at')
      .gte('created_at', fromIso)
      .order('created_at', { ascending: false })
      .limit(5000);

    if (messageError) {
      return NextResponse.json({ error: messageError.message || 'Failed to fetch messages' }, { status: 500 });
    }

    const { count: totalTemplates, error: templateError } = await db
      .from('whatsapp_templates')
      .select('*', { count: 'exact', head: true });
    if (templateError) {
      return NextResponse.json({ error: templateError.message || 'Failed to fetch templates' }, { status: 500 });
    }

    const { count: approvedTemplates, error: approvedTemplateError } = await db
      .from('whatsapp_templates')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);
    if (approvedTemplateError) {
      return NextResponse.json(
        { error: approvedTemplateError.message || 'Failed to fetch approved templates' },
        { status: 500 }
      );
    }

    const { data: webhookRows, error: webhookError } = await db
      .from('whatsapp_webhook_events')
      .select('id, process_status, process_note, received_at, processed_at')
      .gte('received_at', fromIso)
      .order('received_at', { ascending: false })
      .limit(20);

    if (webhookError) {
      return NextResponse.json({ error: webhookError.message || 'Failed to fetch webhook events' }, { status: 500 });
    }

    const total = (messageRows || []).length;
    const delivered = (messageRows || []).filter((row: any) => String(row.status || '').toUpperCase() === 'DELIVERED').length;
    const read = (messageRows || []).filter((row: any) => String(row.status || '').toUpperCase() === 'VIEWED').length;
    const failed = (messageRows || []).filter((row: any) => String(row.status || '').toUpperCase() === 'FAILED').length;
    const sent = (messageRows || []).filter((row: any) => String(row.status || '').toUpperCase() === 'SENT').length;

    const templateFrequency: Record<string, number> = {};
    for (const row of messageRows || []) {
      const name = String((row as any)?.template_name || '').trim();
      if (!name) continue;
      templateFrequency[name] = (templateFrequency[name] || 0) + 1;
    }

    const topTemplates = Object.entries(templateFrequency)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return NextResponse.json({
      success: true,
      range,
      from: fromIso,
      kpis: {
        total_messages: total,
        sent,
        delivered,
        read,
        failed,
        delivery_rate: total > 0 ? (delivered / total) * 100 : 0,
        read_rate: total > 0 ? (read / total) * 100 : 0,
        failure_rate: total > 0 ? (failed / total) * 100 : 0,
        total_templates: totalTemplates || 0,
        approved_templates: approvedTemplates || 0,
      },
      top_templates: topTemplates,
      recent_events: (webhookRows || []).map((event: any) => ({
        id: event.id,
        status: event.process_status,
        note: event.process_note,
        time: event.received_at,
      })),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
