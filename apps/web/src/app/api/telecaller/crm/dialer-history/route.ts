import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { crmSeesAllLeads } from '@/lib/telecaller/crmRoles';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MISSED_STATUSES = new Set([
  'NO_ANSWER',
  'MISSED',
  'BUSY',
  'SWITCHED_OFF',
  'FAILED',
  'CANCELLED',
  'NOT_CONNECTED',
]);

function isMissedCall(row: { call_status?: unknown; call_duration?: unknown; call_type?: unknown }) {
  const status = String(row.call_status || '').toUpperCase();
  const type = String(row.call_type || '').toUpperCase();
  const dur = Number(row.call_duration) || 0;
  if (MISSED_STATUSES.has(status)) return true;
  if (type === 'INBOUND' && (status === 'RINGING' || status === 'NO_ANSWER' || !status) && dur < 1) {
    return true;
  }
  if ((status === 'RINGING' || status === 'NO_ANSWER') && dur < 1) return true;
  return false;
}

/**
 * GET /api/telecaller/crm/dialer-history
 * Recent / missed call feed for the Dialer UI (telecaller = own logs; LM = team).
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClientFromRequest(request);
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await resolveUserProfile(supabase, user);
    const roleCode = String((profile as any)?.roles?.role_code || '')
      .trim()
      .toUpperCase();
    const allowed = new Set(['TELECALLER', 'LEAD_MANAGER', 'SUPER_ADMIN', 'SUB_ADMIN']);
    if (!allowed.has(roleCode) || !profile?.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const sp = request.nextUrl.searchParams;
    const q = String(sp.get('q') || '').trim().toLowerCase();
    const filter = String(sp.get('filter') || 'all').trim().toLowerCase(); // all | missed
    const days = Math.min(30, Math.max(1, Number(sp.get('days') || 14) || 14));
    const limit = Math.min(150, Math.max(20, Number(sp.get('limit') || 80) || 80));

    const { supabaseAdmin } = getSupabaseAdmin();
    const db = supabaseAdmin ?? supabase;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const seesAll = crmSeesAllLeads(roleCode);

    let query = db
      .from('telecaller_call_logs')
      .select(
        `
        id, telecaller_id, call_type, call_status, call_duration, phone_number, notes, created_at,
        call_recording_url,
        lead:service_leads!lead_id(
          id, lead_number, customer_name, customer_phone, status
        )
      `,
      )
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (!seesAll) {
      query = query.eq('telecaller_id', String(profile.id));
    }

    const { data, error: qErr } = await query;
    if (qErr) {
      return NextResponse.json({ error: qErr.message || 'Failed to load' }, { status: 500 });
    }

    let rows = Array.isArray(data) ? data : [];

    if (q) {
      rows = rows.filter((r: any) => {
        const lead = r.lead || {};
        const hay = [
          lead.customer_name,
          lead.customer_phone,
          lead.lead_number,
          r.phone_number,
          r.notes,
        ]
          .map((x) => String(x || '').toLowerCase())
          .join(' ');
        return hay.includes(q);
      });
    }

    const mapped = rows.map((r: any) => {
      const lead = r.lead || null;
      const phone =
        String(r.phone_number || '').replace(/\D/g, '').slice(-10) ||
        String(lead?.customer_phone || '')
          .replace(/\D/g, '')
          .slice(-10) ||
        '';
      const missed = isMissedCall(r);
      return {
        id: String(r.id),
        created_at: r.created_at,
        call_type: r.call_type,
        call_status: r.call_status,
        call_duration: r.call_duration,
        phone_number: phone || null,
        notes: r.notes || null,
        has_recording: Boolean(r.call_recording_url),
        is_missed: missed,
        lead: lead
          ? {
              id: lead.id,
              lead_number: lead.lead_number,
              customer_name: lead.customer_name,
              customer_phone: lead.customer_phone,
              status: lead.status,
            }
          : null,
      };
    });

    const missedRows = mapped.filter((r) => r.is_missed);
    const list = filter === 'missed' ? missedRows : mapped;

    return NextResponse.json({
      success: true,
      filter,
      days,
      total: list.length,
      missed_count: missedRows.length,
      all_count: mapped.length,
      calls: list,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 });
  }
}
