import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function normalizePhone(phone: string): string {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  const last10 = digits.slice(-10);
  if (last10.length === 10) return `91${last10}`;
  return digits.startsWith('91') ? digits : `91${digits}`;
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

  return { ok: true as const, userId: String((profile as any)?.id || user.id), roleCode };
}

/**
 * GET /api/telecaller/crm/lead-timeline?lead_id=
 * Unified timeline: call logs + follow-ups + recent WA messages + status hints.
 */
export async function GET(request: NextRequest) {
  try {
    const gate = await requireCrmUser(request);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const leadId = String(request.nextUrl.searchParams.get('lead_id') || '').trim();
    if (!leadId) return NextResponse.json({ error: 'lead_id required' }, { status: 400 });

    const { supabaseAdmin } = getSupabaseAdmin();
    if (!supabaseAdmin) return NextResponse.json({ error: 'Admin unavailable' }, { status: 500 });

    const { data: lead, error: leadErr } = await supabaseAdmin
      .from('service_leads')
      .select(
        'id, lead_number, customer_phone, customer_name, status, created_at, updated_at, assigned_telecaller_id, coupon_meta, telecaller_remarks',
      )
      .eq('id', leadId)
      .maybeSingle();

    if (leadErr || !lead) {
      return NextResponse.json({ error: leadErr?.message || 'Lead not found' }, { status: 404 });
    }

    // Telecaller: only own / created leads
    if (gate.roleCode === 'TELECALLER') {
      const assigned = String((lead as any).assigned_telecaller_id || '');
      if (assigned && assigned !== gate.userId) {
        // allow if they have call logs on it
        const { count } = await supabaseAdmin
          .from('telecaller_call_logs')
          .select('id', { count: 'exact', head: true })
          .eq('lead_id', leadId)
          .eq('telecaller_id', gate.userId);
        if (!count) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
      }
    }

    const phone = normalizePhone(String((lead as any).customer_phone || ''));

    const [callsRes, fuRes, waRes] = await Promise.all([
      supabaseAdmin
        .from('telecaller_call_logs')
        .select(
          'id, call_status, call_duration, outcome, notes, created_at, telecaller_id, telecaller:telecaller_id(full_name)',
        )
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })
        .limit(50),
      supabaseAdmin
        .from('telecaller_follow_ups')
        .select('id, follow_up_type, status, scheduled_time, notes, created_at, completed_at, telecaller_id')
        .eq('lead_id', leadId)
        .order('scheduled_time', { ascending: false })
        .limit(30),
      phone
        ? supabaseAdmin
            .from('whatsapp_messages')
            .select(
              'id, direction, message_type, text_body, media_caption, template_name, status, created_at, sender_phone, recipient_phone',
            )
            .or(`sender_phone.eq.${phone},recipient_phone.eq.${phone}`)
            .order('created_at', { ascending: false })
            .limit(40)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    type Item = {
      id: string;
      kind: 'call' | 'followup' | 'whatsapp' | 'system';
      at: string;
      title: string;
      body?: string | null;
      meta?: Record<string, unknown>;
    };

    const items: Item[] = [];

    items.push({
      id: `lead-created-${leadId}`,
      kind: 'system',
      at: String((lead as any).created_at),
      title: 'Lead created',
      body: String((lead as any).lead_number || ''),
      meta: { status: (lead as any).status },
    });

    for (const log of callsRes.data || []) {
      const note = String((log as any).notes || '');
      const label = note.match(/^\[([^\]]+)\]/)?.[1] || String((log as any).call_status || 'Call');
      items.push({
        id: `call-${(log as any).id}`,
        kind: 'call',
        at: String((log as any).created_at),
        title: label,
        body: note || null,
        meta: {
          call_status: (log as any).call_status,
          outcome: (log as any).outcome,
          duration: (log as any).call_duration,
          by: (log as any).telecaller?.full_name || null,
        },
      });
    }

    for (const fu of fuRes.data || []) {
      items.push({
        id: `fu-${(fu as any).id}`,
        kind: 'followup',
        at: String((fu as any).completed_at || (fu as any).scheduled_time || (fu as any).created_at),
        title: `${(fu as any).follow_up_type || 'Follow-up'} · ${(fu as any).status || ''}`,
        body: (fu as any).notes || null,
        meta: { scheduled_time: (fu as any).scheduled_time },
      });
    }

    for (const msg of waRes.data || []) {
      const dir = String((msg as any).direction || '').toUpperCase();
      const text =
        String((msg as any).text_body || '').trim() ||
        String((msg as any).media_caption || '').trim() ||
        ((msg as any).template_name ? `Template: ${(msg as any).template_name}` : null) ||
        String((msg as any).message_type || 'Message');
      items.push({
        id: `wa-${(msg as any).id}`,
        kind: 'whatsapp',
        at: String((msg as any).created_at),
        title: dir === 'INBOUND' ? 'WhatsApp inbound' : 'WhatsApp outbound',
        body: text.slice(0, 280),
        meta: { status: (msg as any).status, message_type: (msg as any).message_type },
      });
    }

    const meta =
      (lead as any).coupon_meta && typeof (lead as any).coupon_meta === 'object'
        ? (lead as any).coupon_meta
        : {};
    if (meta.last_call_label || meta.last_call_result) {
      items.push({
        id: `disp-${leadId}`,
        kind: 'system',
        at: String((lead as any).updated_at || (lead as any).created_at),
        title: `Disposition · ${meta.last_call_label || meta.last_call_result}`,
        body: (lead as any).telecaller_remarks || null,
      });
    }

    items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

    return NextResponse.json({
      success: true,
      lead_id: leadId,
      items: items.slice(0, 100),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Timeline failed' }, { status: 500 });
  }
}
