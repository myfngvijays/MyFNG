import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';
import {
  resolveReportDateRange,
  type ReportDatePreset,
} from '@/lib/report-date-range';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CALL_STATUS_FILTERS = new Set([
  'ALL',
  'ANSWERED',
  'NO_ANSWER',
  'BUSY',
  'FAILED',
  'CANCELLED',
  'MISSED',
  'RINGING',
]);

const DURATION_FILTERS = new Set(['ALL', 'CONNECTED', 'SHORT', 'MEDIUM', 'LONG', 'ZERO']);
const LEAD_LINK_FILTERS = new Set(['ALL', 'WITH_LEAD', 'NO_LEAD']);

function normalizeStatus(raw: string) {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');
}

/**
 * GET /api/super_admin/recordings
 * Paginated call recordings with CRM-style filters + summary stats.
 */
export async function GET(request: NextRequest) {
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
    const roleCode = String((profile?.roles as any)?.role_code || '')
      .trim()
      .toUpperCase();
    const allowed = new Set(['SUPER_ADMIN', 'SUB_ADMIN', 'LEAD_MANAGER']);
    if (!allowed.has(roleCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const sp = request.nextUrl.searchParams;
    const q = String(sp.get('q') || '').trim();
    const telecallerId = String(sp.get('telecaller_id') || '').trim();
    const callStatus = normalizeStatus(sp.get('call_status') || 'ALL');
    const outcome = normalizeStatus(sp.get('outcome') || 'ALL');
    const durationBucket = normalizeStatus(sp.get('duration') || 'ALL');
    const leadLink = normalizeStatus(sp.get('lead_link') || 'ALL');
    const groupBy = String(sp.get('group_by') || 'date').trim().toLowerCase(); // date | telecaller | none
    const exportCsv = sp.get('export') === '1';
    const idsParam = String(sp.get('ids') || '')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, 2000);
    const page = Math.max(1, Number(sp.get('page') || 1) || 1);
    const limit = exportCsv
      ? Math.min(5000, Math.max(1, Number(sp.get('limit') || 5000) || 5000))
      : Math.min(100, Math.max(10, Number(sp.get('limit') || 40) || 40));
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const presetRaw = String(sp.get('preset') || sp.get('days') || 'last_30_days').trim();
    // Back-compat: days=7 → last_7_days
    let preset: ReportDatePreset = 'last_30_days';
    if (/^\d+$/.test(presetRaw)) {
      const n = Number(presetRaw);
      if (n <= 1) preset = 'today';
      else if (n <= 7) preset = 'last_7_days';
      else if (n <= 14) preset = 'last_14_days';
      else if (n <= 30) preset = 'last_30_days';
      else preset = 'this_year';
    } else {
      preset = (presetRaw as ReportDatePreset) || 'last_30_days';
    }
    const customStart = String(sp.get('start') || '').trim() || null;
    const customEnd = String(sp.get('end') || '').trim() || null;
    const range = resolveReportDateRange(preset, customStart, customEnd);

    if (!CALL_STATUS_FILTERS.has(callStatus)) {
      return NextResponse.json({ error: 'Invalid call_status' }, { status: 400 });
    }
    if (!DURATION_FILTERS.has(durationBucket)) {
      return NextResponse.json({ error: 'Invalid duration' }, { status: 400 });
    }
    if (!LEAD_LINK_FILTERS.has(leadLink)) {
      return NextResponse.json({ error: 'Invalid lead_link' }, { status: 400 });
    }

    const { supabaseAdmin } = getSupabaseAdmin();
    const db = supabaseAdmin ?? supabase;

    // Resolve text search → lead ids (name / lead_number / phone variants)
    let leadIdsFromSearch: string[] | null = null;
    const digitsAll = q.replace(/\D/g, '');
    const digits10 = digitsAll.length >= 10 ? digitsAll.slice(-10) : digitsAll;
    if (q) {
      const safeQ = q.replace(/,/g, ' ');
      const orParts = [
        `customer_name.ilike.%${safeQ}%`,
        `lead_number.ilike.%${safeQ}%`,
      ];
      if (digitsAll.length >= 4) {
        orParts.push(`customer_phone.ilike.%${digitsAll}%`);
        if (digits10 && digits10 !== digitsAll) {
          orParts.push(`customer_phone.ilike.%${digits10}%`);
        }
      }
      const { data: leadHits } = await db
        .from('service_leads')
        .select('id')
        .or(orParts.join(','))
        .limit(500);
      leadIdsFromSearch = (Array.isArray(leadHits) ? leadHits : [])
        .map((r: any) => String(r.id || '').trim())
        .filter(Boolean);
    }

    function applyCommonFilters(query: any) {
      let next = query
        .not('call_recording_url', 'is', null)
        .neq('call_recording_url', '');

      if (idsParam.length > 0) {
        next = next.in('id', idsParam);
      } else {
        next = next.gte('created_at', range.start).lte('created_at', range.end);
      }

      if (telecallerId) {
        next = next.eq('telecaller_id', telecallerId);
      }
      if (callStatus !== 'ALL') {
        next = next.eq('call_status', callStatus);
      }
      if (outcome !== 'ALL') {
        next = next.eq('outcome', outcome);
      }
      if (leadLink === 'WITH_LEAD') {
        next = next.not('lead_id', 'is', null);
      } else if (leadLink === 'NO_LEAD') {
        next = next.is('lead_id', null);
      }

      if (durationBucket === 'CONNECTED') {
        next = next.gt('call_duration', 0);
      } else if (durationBucket === 'ZERO') {
        next = next.or('call_duration.is.null,call_duration.eq.0');
      } else if (durationBucket === 'SHORT') {
        next = next.gt('call_duration', 0).lte('call_duration', 30);
      } else if (durationBucket === 'MEDIUM') {
        next = next.gt('call_duration', 30).lte('call_duration', 120);
      } else if (durationBucket === 'LONG') {
        next = next.gt('call_duration', 120);
      }

      if (q && idsParam.length === 0) {
        const safeQ = q.replace(/,/g, ' ');
        const parts: string[] = [`notes.ilike.%${safeQ}%`];
        if (digitsAll.length >= 4) {
          parts.push(`phone_number.ilike.%${digitsAll}%`);
          if (digits10 && digits10 !== digitsAll) {
            parts.push(`phone_number.ilike.%${digits10}%`);
          }
        }
        if (leadIdsFromSearch && leadIdsFromSearch.length > 0) {
          parts.push(`lead_id.in.(${leadIdsFromSearch.join(',')})`);
        }
        next = next.or(parts.join(','));
      }

      return next;
    }

    const selectCols = `
      id,
      lead_id,
      telecaller_id,
      call_type,
      call_status,
      call_duration,
      outcome,
      phone_number,
      notes,
      created_at,
      call_recording_url,
      smartflo_call_id,
      lead:service_leads!lead_id(
        id, lead_number, customer_name, customer_phone, status, city
      ),
      telecaller:telecaller_id(id, full_name)
    `;

    let listQuery = applyCommonFilters(
      db.from('telecaller_call_logs').select(selectCols, { count: 'exact' }),
    ).order('created_at', { ascending: false });

    if (!exportCsv) {
      listQuery = listQuery.range(from, to);
    } else {
      listQuery = listQuery.limit(limit);
    }

    // Facet counts (same filters, cheap head counts) — skip on export
    const countAnswered = applyCommonFilters(
      db.from('telecaller_call_logs').select('id', { count: 'exact', head: true }),
    ).eq('call_status', 'ANSWERED');

    const countNoAnswer = applyCommonFilters(
      db.from('telecaller_call_logs').select('id', { count: 'exact', head: true }),
    ).in('call_status', ['NO_ANSWER', 'MISSED', 'BUSY', 'FAILED', 'CANCELLED']);

    const countWithLead = applyCommonFilters(
      db.from('telecaller_call_logs').select('id', { count: 'exact', head: true }),
    ).not('lead_id', 'is', null);

    const countShort = applyCommonFilters(
      db.from('telecaller_call_logs').select('id', { count: 'exact', head: true }),
    )
      .gt('call_duration', 0)
      .lte('call_duration', 30);

    const telecallersQuery = db
      .from('users_login')
      .select('id, full_name, roles!inner(role_code)')
      .eq('roles.role_code', 'TELECALLER')
      .order('full_name', { ascending: true })
      .limit(200);

    const skipFacets = exportCsv || idsParam.length > 0;
    const [
      listRes,
      answeredRes,
      noAnswerRes,
      withLeadRes,
      shortRes,
      telecallersRes,
    ] = await Promise.all([
      listQuery,
      !skipFacets && callStatus === 'ALL'
        ? countAnswered
        : Promise.resolve({ count: null, error: null }),
      !skipFacets && callStatus === 'ALL'
        ? countNoAnswer
        : Promise.resolve({ count: null, error: null }),
      !skipFacets && leadLink === 'ALL'
        ? countWithLead
        : Promise.resolve({ count: null, error: null }),
      !skipFacets && durationBucket === 'ALL'
        ? countShort
        : Promise.resolve({ count: null, error: null }),
      exportCsv ? Promise.resolve({ data: [] as any[], error: null }) : telecallersQuery,
    ]);

    if (listRes.error) {
      return NextResponse.json(
        { error: listRes.error.message || 'Failed to load recordings' },
        { status: 500 },
      );
    }

    const rows = Array.isArray(listRes.data) ? listRes.data : [];
    const total = typeof listRes.count === 'number' ? listRes.count : rows.length;

    const mapped = rows.map((r: any) => {
      const lead = r.lead || null;
      const tele = r.telecaller || null;
      return {
        id: r.id,
        lead_id: r.lead_id || lead?.id || null,
        lead_number: lead?.lead_number || null,
        customer_name: lead?.customer_name || null,
        customer_phone: lead?.customer_phone || r.phone_number || null,
        lead_status: lead?.status || null,
        city: lead?.city || null,
        phone_number: r.phone_number || null,
        telecaller_id: r.telecaller_id || null,
        telecaller_name: tele?.full_name || null,
        call_type: r.call_type || null,
        call_status: r.call_status || null,
        outcome: r.outcome || null,
        call_duration: r.call_duration ?? null,
        notes: r.notes || null,
        created_at: r.created_at,
        has_recording: Boolean(String(r.call_recording_url || '').trim()),
      };
    });

    if (exportCsv) {
      const csvEscape = (v: unknown) => {
        const s = String(v ?? '');
        if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
        return s;
      };
      const headers = [
        'created_at',
        'lead_number',
        'customer_name',
        'phone',
        'city',
        'lead_status',
        'telecaller',
        'call_status',
        'outcome',
        'duration_sec',
        'notes',
        'call_log_id',
        'lead_id',
      ];
      const lines = [headers.join(',')];
      for (const r of mapped) {
        lines.push(
          [
            r.created_at,
            r.lead_number,
            r.customer_name,
            r.customer_phone || r.phone_number,
            r.city,
            r.lead_status,
            r.telecaller_name,
            r.call_status,
            r.outcome,
            r.call_duration,
            String(r.notes || '')
              .replace(/\[Smartflo\]\s*/gi, '')
              .replace(/\bSmartflo\b/gi, '')
              .trim(),
            r.id,
            r.lead_id,
          ]
            .map(csvEscape)
            .join(','),
        );
      }
      const stamp = new Date().toISOString().slice(0, 10);
      return new NextResponse(lines.join('\n'), {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="recordings-${stamp}.csv"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    return NextResponse.json({
      success: true,
      rows: mapped,
      page,
      limit,
      total,
      total_pages: Math.max(1, Math.ceil(total / limit)),
      range_label: range.label,
      preset: range.preset,
      group_by: ['date', 'telecaller', 'none'].includes(groupBy) ? groupBy : 'date',
      stats: {
        total,
        answered: typeof answeredRes.count === 'number' ? answeredRes.count : null,
        no_answer: typeof noAnswerRes.count === 'number' ? noAnswerRes.count : null,
        with_lead: typeof withLeadRes.count === 'number' ? withLeadRes.count : null,
        short: typeof shortRes.count === 'number' ? shortRes.count : null,
      },
      telecallers: (Array.isArray(telecallersRes.data) ? telecallersRes.data : []).map(
        (t: any) => ({
          id: t.id,
          full_name: t.full_name || 'Telecaller',
        }),
      ),
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Internal server error' },
      { status: 500 },
    );
  }
}
