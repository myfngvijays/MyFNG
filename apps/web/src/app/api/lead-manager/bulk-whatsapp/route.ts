import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { sendTemplateMessage, sendTextMessage } from '@/lib/services/whatsappService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function normalizePhone(phone: string): string {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  const last10 = digits.slice(-10);
  if (last10.length === 10) return `91${last10}`;
  return digits.startsWith('91') ? digits : `91${digits}`;
}

function last10(phone: string): string {
  return String(phone || '').replace(/\D/g, '').slice(-10);
}

async function requireBulkWaRole(request: NextRequest) {
  const supabase = await createClientFromRequest(request);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return { ok: false as const, status: 401, error: 'Unauthorized' };

  const { data: profile } = await supabase
    .from('users_login')
    .select('id, full_name, roles!role_id(role_code)')
    .eq('id', user.id)
    .maybeSingle();

  const roleCode = String((profile as { roles?: { role_code?: string } } | null)?.roles?.role_code || '')
    .trim()
    .toUpperCase();

  // Explicitly NOT TELECALLER
  if (!['LEAD_MANAGER', 'SUPER_ADMIN', 'SUB_ADMIN'].includes(roleCode)) {
    return { ok: false as const, status: 403, error: 'Bulk WhatsApp is for Lead Manager / Admin only' };
  }

  return {
    ok: true as const,
    userId: String((profile as { id?: string } | null)?.id || user.id),
    fullName: String((profile as { full_name?: string } | null)?.full_name || 'Manager'),
    roleCode,
  };
}

/**
 * POST /api/lead-manager/bulk-whatsapp
 * LM / Super Admin only — never telecaller.
 * Body: {
 *   lead_ids: string[],
 *   message_type: 'text' | 'template',
 *   text?: string,
 *   template_name?: string,
 *   language_code?: string,
 *   components?: any[]
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const gate = await requireBulkWaRole(request);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const body = await request.json().catch(() => ({}));
    const leadIds = Array.isArray(body?.lead_ids)
      ? body.lead_ids.map((x: unknown) => String(x || '').trim()).filter(Boolean)
      : [];
    const messageType = String(body?.message_type || 'text').toLowerCase();
    const text = String(body?.text || '').trim();
    const templateName = String(body?.template_name || '').trim();
    const languageCode = String(body?.language_code || 'en').trim() || 'en';
    const components = Array.isArray(body?.components) ? body.components : undefined;

    if (!leadIds.length) {
      return NextResponse.json({ error: 'lead_ids required' }, { status: 400 });
    }
    if (leadIds.length > 100) {
      return NextResponse.json({ error: 'Max 100 leads per bulk WhatsApp' }, { status: 400 });
    }
    if (messageType === 'text' && !text) {
      return NextResponse.json({ error: 'text required' }, { status: 400 });
    }
    if (messageType === 'template' && !templateName) {
      return NextResponse.json({ error: 'template_name required' }, { status: 400 });
    }
    if (messageType !== 'text' && messageType !== 'template') {
      return NextResponse.json({ error: 'message_type must be text or template' }, { status: 400 });
    }

    const { supabaseAdmin } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Admin client unavailable' }, { status: 500 });
    }

    const { data: leads, error: leadErr } = await supabaseAdmin
      .from('service_leads')
      .select('id, lead_number, customer_name, customer_phone')
      .in('id', leadIds);

    if (leadErr) {
      return NextResponse.json({ error: leadErr.message }, { status: 500 });
    }

    const rows = Array.isArray(leads) ? leads : [];
    const phones = rows.map((l) => last10(String(l.customer_phone || ''))).filter((p) => p.length === 10);

    let dndSet = new Set<string>();
    if (phones.length) {
      const { data: dndRows } = await supabaseAdmin
        .from('whatsapp_dnd_numbers')
        .select('phone_last10')
        .in('phone_last10', phones);
      dndSet = new Set((dndRows || []).map((d: any) => String(d.phone_last10)));
    }

    const results: Array<{
      lead_id: string;
      phone: string;
      ok: boolean;
      skipped?: string;
      error?: string;
    }> = [];

    for (const lead of rows) {
      const phoneNorm = normalizePhone(String(lead.customer_phone || ''));
      const l10 = last10(phoneNorm);
      if (!l10 || l10.length !== 10) {
        results.push({
          lead_id: String(lead.id),
          phone: '',
          ok: false,
          skipped: 'invalid_phone',
        });
        continue;
      }
      if (dndSet.has(l10)) {
        results.push({
          lead_id: String(lead.id),
          phone: phoneNorm,
          ok: false,
          skipped: 'dnd',
        });
        continue;
      }

      try {
        if (messageType === 'template') {
          await sendTemplateMessage(phoneNorm, templateName, languageCode, components);
        } else {
          await sendTextMessage(phoneNorm, text);
        }
        results.push({ lead_id: String(lead.id), phone: phoneNorm, ok: true });
      } catch (e: any) {
        results.push({
          lead_id: String(lead.id),
          phone: phoneNorm,
          ok: false,
          error: e?.message || 'send_failed',
        });
      }
    }

    const sent = results.filter((r) => r.ok).length;
    const dnd = results.filter((r) => r.skipped === 'dnd').length;
    const failed = results.filter((r) => !r.ok && !r.skipped).length;

    return NextResponse.json({
      success: true,
      sent,
      dnd_skipped: dnd,
      failed,
      total: results.length,
      results,
      sent_by: gate.fullName,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
