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

function preview(row: any): string {
  const text = String(row?.text_body || '').trim();
  if (text) return text.slice(0, 160);
  const caption = String(row?.media_caption || '').trim();
  if (caption) return caption.slice(0, 160);
  if (row?.template_name) return `Template: ${row.template_name}`;
  return String(row?.message_type || 'Message');
}

async function requireManager(request: NextRequest) {
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

  if (!['LEAD_MANAGER', 'SUPER_ADMIN', 'SUB_ADMIN'].includes(roleCode)) {
    return { ok: false as const, status: 403, error: 'Forbidden' };
  }
  return { ok: true as const };
}

/**
 * GET /api/lead-manager/team-whatsapp
 * Manager oversight: assigned chats + unanswered age + optional telecaller filter.
 * Query: telecaller_id?, unanswered_hours?, q?, limit?
 */
export async function GET(request: NextRequest) {
  try {
    const gate = await requireManager(request);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const { supabaseAdmin } = getSupabaseAdmin();
    if (!supabaseAdmin) return NextResponse.json({ error: 'Admin unavailable' }, { status: 500 });

    const telecallerId = String(request.nextUrl.searchParams.get('telecaller_id') || '').trim();
    const unansweredHours = Math.max(
      0,
      Number(request.nextUrl.searchParams.get('unanswered_hours') || 0) || 0,
    );
    const q = String(request.nextUrl.searchParams.get('q') || '').trim().toLowerCase();
    const limit = Math.min(150, Math.max(20, Number(request.nextUrl.searchParams.get('limit') || 80) || 80));

    const { data: assignments, error: aErr } = await supabaseAdmin
      .from('whatsapp_chat_assignments')
      .select('phone, assigned_to_ids, assigned_at, updated_at, assigned_note')
      .order('updated_at', { ascending: false })
      .limit(400);

    if (aErr) {
      return NextResponse.json({ error: aErr.message }, { status: 500 });
    }

    let rows = assignments || [];
    if (telecallerId) {
      rows = rows.filter((r: any) => {
        const ids = Array.isArray(r.assigned_to_ids) ? r.assigned_to_ids.map(String) : [];
        return ids.includes(telecallerId);
      });
    }

    // Dedupe by normalized phone (table can have duplicate/legacy rows for same chat)
    const byPhone = new Map<string, any>();
    for (const r of rows) {
      const phone = normalizePhone(String((r as any).phone || ''));
      if (!phone) continue;
      const existing = byPhone.get(phone);
      if (!existing) {
        byPhone.set(phone, {
          ...r,
          phone,
          assigned_to_ids: Array.isArray((r as any).assigned_to_ids)
            ? [...new Set((r as any).assigned_to_ids.map(String))]
            : [],
        });
        continue;
      }
      const mergedIds = new Set<string>([
        ...(Array.isArray(existing.assigned_to_ids) ? existing.assigned_to_ids.map(String) : []),
        ...(Array.isArray((r as any).assigned_to_ids) ? (r as any).assigned_to_ids.map(String) : []),
      ]);
      const existingTs = new Date(String(existing.updated_at || existing.assigned_at || 0)).getTime();
      const rowTs = new Date(String((r as any).updated_at || (r as any).assigned_at || 0)).getTime();
      byPhone.set(phone, {
        ...(rowTs >= existingTs ? r : existing),
        phone,
        assigned_to_ids: Array.from(mergedIds),
        updated_at:
          rowTs >= existingTs
            ? (r as any).updated_at || existing.updated_at
            : existing.updated_at || (r as any).updated_at,
      });
    }
    rows = Array.from(byPhone.values()).sort((a, b) => {
      const ta = new Date(String(a.updated_at || a.assigned_at || 0)).getTime();
      const tb = new Date(String(b.updated_at || b.assigned_at || 0)).getTime();
      return tb - ta;
    });

    const assigneeIds = new Set<string>();
    for (const r of rows) {
      for (const id of Array.isArray((r as any).assigned_to_ids) ? (r as any).assigned_to_ids : []) {
        if (id) assigneeIds.add(String(id));
      }
    }

    const { data: users } = assigneeIds.size
      ? await supabaseAdmin
          .from('users_login')
          .select('id, full_name, phone')
          .in('id', Array.from(assigneeIds))
      : { data: [] as any[] };

    const userMap = new Map<string, { id: string; full_name: string | null; phone?: string | null }>(
      (users || []).map((u: any) => [
        String(u.id),
        { id: String(u.id), full_name: u.full_name || null, phone: u.phone || null },
      ]),
    );

    const chats: any[] = [];
    const now = Date.now();

    // Enrich a capped subset with last message
    const slice = rows.slice(0, limit);
    for (const row of slice) {
      const phone = normalizePhone(String((row as any).phone || ''));
      if (!phone) continue;

      const { data: lastMsgs } = await supabaseAdmin
        .from('whatsapp_messages')
        .select(
          'id, direction, text_body, media_caption, template_name, message_type, status, created_at',
        )
        .or(`sender_phone.eq.${phone},recipient_phone.eq.${phone}`)
        .order('created_at', { ascending: false })
        .limit(1);

      const last = lastMsgs?.[0] || null;
      const lastAt = last ? new Date(String((last as any).created_at)).getTime() : 0;
      const inboundUnanswered =
        last && String((last as any).direction || '').toUpperCase() === 'INBOUND';
      const ageHours = lastAt ? (now - lastAt) / 3600000 : null;

      if (unansweredHours > 0) {
        if (!inboundUnanswered || ageHours == null || ageHours < unansweredHours) continue;
      }

      const assignees = (Array.isArray((row as any).assigned_to_ids) ? (row as any).assigned_to_ids : [])
        .map((id: string) => {
          const u = userMap.get(String(id));
          return u
            ? { id: String(u.id), full_name: u.full_name || null }
            : { id: String(id), full_name: null };
        });

      const nameHint = assignees.map((a: any) => a.full_name).filter(Boolean).join(', ');
      if (q) {
        const hay = `${phone} ${nameHint} ${preview(last || {})}`.toLowerCase();
        if (!hay.includes(q)) continue;
      }

      chats.push({
        phone,
        assigned_at: (row as any).assigned_at,
        updated_at: (row as any).updated_at,
        note: (row as any).assigned_note || null,
        assignees,
        last_message: last
          ? {
              direction: (last as any).direction,
              preview: preview(last),
              at: (last as any).created_at,
              status: (last as any).status,
            }
          : null,
        unanswered_inbound: Boolean(inboundUnanswered),
        unanswered_hours: inboundUnanswered && ageHours != null ? Math.round(ageHours * 10) / 10 : null,
      });
    }

    return NextResponse.json({
      success: true,
      total: chats.length,
      chats,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Team WA failed' }, { status: 500 });
  }
}
