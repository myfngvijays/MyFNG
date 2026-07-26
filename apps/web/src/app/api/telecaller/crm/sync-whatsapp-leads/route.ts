import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { ensureWhatsAppInboundServiceLead } from '@/lib/whatsappAgents/inboundServiceLead';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED = new Set(['TELECALLER', 'SUPER_ADMIN', 'SUB_ADMIN', 'LEAD_MANAGER', 'APP_OPERATIONS']);

/**
 * POST /api/telecaller/crm/sync-whatsapp-leads
 * Backfill service_leads from recent inbound WhatsApp messages.
 * Body: { hours?: number, phone?: string, limit?: number }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClientFromRequest(request);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await resolveUserProfile(supabase, user);
    const roleCode = String((profile as any)?.roles?.role_code || '').toUpperCase();
    if (!ALLOWED.has(roleCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: adminError || 'Admin unavailable' }, { status: 500 });
    }

    const body = await request.json().catch(() => ({}));
    const hours = Math.min(Math.max(Number(body?.hours) || 72, 1), 24 * 30);
    const limit = Math.min(Math.max(Number(body?.limit) || 200, 1), 500);
    const phoneFilter = String(body?.phone || '')
      .replace(/\D/g, '')
      .slice(-10);

    const sinceIso = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    let query = supabaseAdmin
      .from('whatsapp_messages')
      .select('id, sender_phone, text_body, created_at, status_at, meta, payload')
      .eq('direction', 'INBOUND')
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (phoneFilter.length === 10) {
      query = query.or(
        `sender_phone.eq.${phoneFilter},sender_phone.eq.91${phoneFilter},sender_phone.ilike.%${phoneFilter}`,
      );
    }

    const { data: rows, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Latest message per phone
    const byPhone = new Map<
      string,
      {
        phone: string;
        text: string | null;
        at: string;
        profileName: string | null;
        providerMessageId: string | null;
        referral: any;
      }
    >();

    for (const row of rows || []) {
      const phone = String(row.sender_phone || '').replace(/\D/g, '');
      const phone10 = phone.slice(-10);
      if (phone10.length < 10) continue;
      if (byPhone.has(phone10)) continue;

      const meta = row.meta && typeof row.meta === 'object' ? (row.meta as any) : {};
      const payload = row.payload && typeof row.payload === 'object' ? (row.payload as any) : {};
      byPhone.set(phone10, {
        phone: phone10,
        text: row.text_body || null,
        at: row.status_at || row.created_at || new Date().toISOString(),
        profileName: meta?.profile_name || null,
        providerMessageId: String(payload?.id || row.id || '').trim() || null,
        referral: payload?.referral || null,
      });
    }

    const results: Array<{
      phone: string;
      created: boolean;
      leadId: string | null;
      skipped?: string;
      assignedTo?: string | null;
    }> = [];

    for (const item of byPhone.values()) {
      const result = await ensureWhatsAppInboundServiceLead({
        phone: item.phone,
        profileName: item.profileName,
        messageText: item.text,
        referral: item.referral,
        providerMessageId: item.providerMessageId,
        inboundReceivedAt: item.at,
      });
      results.push({
        phone: item.phone,
        created: result.created,
        leadId: result.leadId,
        skipped: result.skipped,
        assignedTo: result.assignedTo || null,
      });
    }

    const created = results.filter((r) => r.created).length;
    const enriched = results.filter((r) => !r.created && r.leadId).length;
    const failed = results.filter((r) => !r.leadId).length;

    return NextResponse.json({
      success: true,
      scanned_messages: (rows || []).length,
      unique_phones: results.length,
      created,
      enriched,
      failed,
      results,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Sync failed' }, { status: 500 });
  }
}
