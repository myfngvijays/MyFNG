import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';
import {
  resolveReportDateRange,
  type ReportDatePreset,
} from '@/lib/report-date-range';
import {
  dedupeSmartfloCrmRows,
  isBeforeSmartfloRecordingsCutoff,
  isSmartfloLineNumber,
  smartfloRecordingsCutoffIso,
  boundRecordingUrlForCallId,
} from '@/lib/telecaller/smartfloCdr';
import { assignedDidPhoneSet, getClickToCallConfig, ownerOfDid } from '@/lib/telecaller/clickToCallConfig';
import { normalizePhone10 } from '@/lib/telecaller/initiateClickToCall';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

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
        orParts.push(`customer_alternate_phone.ilike.%${digitsAll}%`);
        if (digits10 && digits10 !== digitsAll) {
          orParts.push(`customer_phone.ilike.%${digits10}%`);
          orParts.push(`customer_alternate_phone.ilike.%${digits10}%`);
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

    let telecallerCallLogIds: string[] | null = null;
    let telecallerLeadIds: string[] | null = null;
    if (telecallerId) {
      const [{ data: tLogs }, { data: tLeads }] = await Promise.all([
        db.from('telecaller_call_logs').select('id').eq('telecaller_id', telecallerId).limit(3000),
        db.from('service_leads').select('id').eq('assigned_telecaller_id', telecallerId).limit(3000),
      ]);
      telecallerCallLogIds = (Array.isArray(tLogs) ? tLogs : [])
        .map((r: any) => String(r.id || '').trim())
        .filter(Boolean);
      telecallerLeadIds = (Array.isArray(tLeads) ? tLeads : [])
        .map((r: any) => String(r.id || '').trim())
        .filter(Boolean);
    }

    function applyCommonFilters(query: any) {
      // CRM-lead CDRs only (audio optional — Tata missed/click-to-call may have empty player).
      let next = query;

      if (idsParam.length > 0) {
        const csv = idsParam.join(',');
        next = next.or(`id.in.(${csv}),call_log_id.in.(${csv})`);
      } else {
        const cutoffIso = smartfloRecordingsCutoffIso();
        const start =
          Date.parse(range.start) > Date.parse(cutoffIso) ? range.start : cutoffIso;
        const end = range.end;
        next = next.or(
          `and(started_at.gte.${start},started_at.lte.${end}),and(started_at.is.null,created_at.gte.${start},created_at.lte.${end})`,
        );
      }

      if (telecallerId) {
        const logCsv = (telecallerCallLogIds || []).join(',');
        const leadCsv = (telecallerLeadIds || []).join(',');
        const parts: string[] = [];
        if (logCsv) parts.push(`call_log_id.in.(${logCsv})`);
        if (leadCsv) parts.push(`lead_id.in.(${leadCsv})`);
        next = parts.length ? next.or(parts.join(',')) : next.eq('id', '00000000-0000-0000-0000-000000000000');
      }
      if (callStatus === 'ANSWERED') {
        next = next.or('status.ilike.%answer%,call_duration.gt.0');
      } else if (callStatus === 'NO_ANSWER') {
        next = next.or(
          'status.ilike.%no_answer%,status.ilike.%no answer%,status.ilike.%miss%,status.ilike.%not_connected%',
        );
      } else if (callStatus !== 'ALL') {
        next = next.ilike('status', `%${callStatus.replace(/_/g, '%')}%`);
      }
      if (leadLink === 'NO_LEAD') {
        next = next.is('lead_id', null);
      } else {
        // Recordings page is CRM-only: never list Smartflo traffic that is not a MyFNG lead.
        next = next.not('lead_id', 'is', null);
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
        const parts: string[] = [`client_number.ilike.%${safeQ}%`, `agent_number.ilike.%${safeQ}%`];
        if (digitsAll.length >= 4) {
          parts.push(`client_number.ilike.%${digitsAll}%`);
          if (digits10 && digits10 !== digitsAll) {
            parts.push(`client_number.ilike.%${digits10}%`);
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
      smartflo_call_id,
      client_number,
      agent_number,
      did_number,
      status,
      call_duration,
      recording_url,
      started_at,
      created_at,
      lead_id,
      call_log_id,
      lead:service_leads!lead_id(
        id, lead_number, customer_name, customer_phone, status, city, assigned_telecaller_id
      )
    `;

    let listQuery = applyCommonFilters(
      db.from('smartflo_call_recordings').select(selectCols),
    ).order('started_at', { ascending: false, nullsFirst: false });

    listQuery = listQuery.limit(exportCsv ? 3000 : 400);

    const telecallersQuery = db
      .from('users_login')
      .select('id, full_name, roles!inner(role_code)')
      .eq('roles.role_code', 'TELECALLER')
      .order('full_name', { ascending: true })
      .limit(200);

    const [listRes, telecallersRes, ctcCfg] = await Promise.all([
      listQuery,
      exportCsv ? Promise.resolve({ data: [] as any[], error: null }) : telecallersQuery,
      getClickToCallConfig(),
    ]);

    if (listRes.error) {
      return NextResponse.json(
        { error: listRes.error.message || 'Failed to load recordings' },
        { status: 500 },
      );
    }

    const assignedDids = assignedDidPhoneSet(ctcCfg);
    const assignedTeleIds = new Set(
      (ctcCfg.did_assignments || [])
        .map((a) => String(a.telecaller_id || '').trim())
        .filter(Boolean),
    );
    const teleNameById = new Map<string, string>();
    for (const t of Array.isArray(telecallersRes.data) ? telecallersRes.data : []) {
      teleNameById.set(String(t.id), String(t.full_name || 'Telecaller'));
    }

    const rawRows = Array.isArray(listRes.data) ? listRes.data : [];
    const cleaned = dedupeSmartfloCrmRows(
      rawRows.filter((r: any) => {
        if (
          isBeforeSmartfloRecordingsCutoff(
            r.started_at ? String(r.started_at) : null,
            null,
            r.created_at ? String(r.created_at) : null,
          )
        ) {
          return false;
        }
        if (isSmartfloLineNumber(r.client_number)) {
          return false;
        }
        if (!r.lead_id) return false;
        if (assignedDids.size > 0) {
          const did10 = normalizePhone10(r.did_number);
          const leadTc = String(r.lead?.assigned_telecaller_id || '').trim();
          const didOk = Boolean(did10 && assignedDids.has(did10));
          const leadOk = Boolean(leadTc && assignedTeleIds.has(leadTc));
          if (!didOk && !leadOk) return false;
        }
        return true;
      }),
    );
    const total = cleaned.length;
    const facetAnswered = cleaned.filter((r: any) => {
      const d = Number(r.call_duration || 0) || 0;
      return d > 0 || /answer/i.test(String(r.status || ''));
    }).length;
    const facetNoAnswer = cleaned.filter((r: any) => {
      const d = Number(r.call_duration || 0) || 0;
      if (d > 0) return false;
      return /no[_ ]?answer|miss|not[_ ]?connected/i.test(String(r.status || ''));
    }).length;
    const facetShort = cleaned.filter((r: any) => {
      const d = Number(r.call_duration || 0) || 0;
      return d > 0 && d <= 30;
    }).length;
    const rows = exportCsv ? cleaned : cleaned.slice(from, to + 1);

    const logIds = rows.map((r: any) => String(r.call_log_id || '').trim()).filter(Boolean);
    const logById = new Map<string, any>();
    if (logIds.length) {
      const { data: logs } = await db
        .from('telecaller_call_logs')
        .select('id, telecaller_id, call_status, notes, created_at, telecaller:telecaller_id(id, full_name)')
        .in('id', logIds);
      for (const l of Array.isArray(logs) ? logs : []) {
        logById.set(String(l.id), l);
      }
    }

    const mapped = rows.map((r: any) => {
      const lead = r.lead || null;
      const log = r.call_log_id ? logById.get(String(r.call_log_id)) : null;
      const tele = log?.telecaller || null;
      const duration = r.call_duration ?? null;
      const rawStatus = String(r.status || log?.call_status || '');
      const u = rawStatus.toUpperCase().replace(/\s+/g, '_');
      const callStatusMapped =
        (duration != null && duration > 0) || /ANSWER/.test(u)
          ? 'ANSWERED'
          : /NO[_]?ANSWER|MISS|NOT[_]?CONNECTED/.test(u)
            ? 'NO_ANSWER'
            : /BUSY/.test(u)
              ? 'BUSY'
              : /FAIL|CANCEL/.test(u)
                ? 'FAILED'
                : u || 'COMPLETED';
      const teleFromDid = ownerOfDid(ctcCfg, r.did_number);
      const teleName =
        tele?.full_name ||
        (teleFromDid ? teleNameById.get(teleFromDid) : null) ||
        null;
      const when = r.started_at || log?.created_at || r.created_at;
      const playId = String(r.id);
      const boundUrl = boundRecordingUrlForCallId(
        String(r.smartflo_call_id || '').trim() || null,
        String(r.recording_url || '').trim() || null,
      );
      const displayPhone = isSmartfloLineNumber(lead?.customer_phone)
        ? null
        : lead?.customer_phone || (isSmartfloLineNumber(r.client_number) ? null : r.client_number);
      return {
        id: playId,
        call_log_id: r.call_log_id || log?.id || null,
        lead_id: r.lead_id || lead?.id || null,
        lead_number: lead?.lead_number || null,
        customer_name: lead?.customer_name || null,
        customer_phone: displayPhone,
        lead_status: lead?.status || null,
        city: lead?.city || null,
        phone_number: displayPhone,
        telecaller_id: log?.telecaller_id || teleFromDid || lead?.assigned_telecaller_id || null,
        telecaller_name: teleName,
        call_type: 'OUTBOUND',
        call_status: callStatusMapped,
        outcome: null,
        call_duration: duration,
        notes: log?.notes || (boundUrl ? 'Recording synced' : 'Call synced from CDR'),
        created_at: when,
        has_recording: Boolean(boundUrl),
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

    const canSync = roleCode === 'SUPER_ADMIN' || roleCode === 'SUB_ADMIN';
    let sync: Record<string, unknown> | null = null;
    try {
      const { getSmartfloRecordingsCronSettings } = await import(
        '@/lib/telecaller/smartfloRecordingsCronSettings'
      );
      const cron = await getSmartfloRecordingsCronSettings();
      const lastMs = cron.last_run_at ? Date.parse(cron.last_run_at) : NaN;
      const staleMs = Math.max(cron.interval_minutes * 2, 30) * 60 * 1000;
      sync = {
        enabled: cron.enabled,
        interval_minutes: cron.interval_minutes,
        hours_back: cron.hours_back,
        last_run_at: cron.last_run_at,
        last_run_ok: cron.last_run_ok,
        last_run_summary: cron.last_run_summary,
        last_skip_reason: cron.last_skip_reason,
        overdue:
          cron.enabled && (!Number.isFinite(lastMs) || Date.now() - lastMs > staleMs),
        can_sync: canSync,
      };
    } catch {
      sync = { can_sync: canSync, overdue: false };
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
        answered: facetAnswered,
        no_answer: facetNoAnswer,
        with_lead: total,
        short: facetShort,
      },
      telecallers: (Array.isArray(telecallersRes.data) ? telecallersRes.data : []).map(
        (t: any) => ({
          id: t.id,
          full_name: t.full_name || 'Telecaller',
        }),
      ),
      sync,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Internal server error' },
      { status: 500 },
    );
  }
}

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
    const roleCode = String((profile?.roles as any)?.role_code || '')
      .trim()
      .toUpperCase();
    if (!['SUPER_ADMIN', 'SUB_ADMIN'].includes(roleCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || 'sync').trim();
    if (action !== 'sync') {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    const { getSmartfloRecordingsCronSettings, markSmartfloRecordingsCronRun } = await import(
      '@/lib/telecaller/smartfloRecordingsCronSettings'
    );
    const { backfillSmartfloRecordingsFromIst, SMARTFLO_RECORDINGS_AFTER_AUG23_IST } = await import(
      '@/lib/telecaller/smartfloCdr'
    );

    const settings = await getSmartfloRecordingsCronSettings();
    const result = await backfillSmartfloRecordingsFromIst(SMARTFLO_RECORDINGS_AFTER_AUG23_IST, {
      timeBudgetMs: 110_000,
      skipPostProcess: true,
      newestFirst: true,
    });
    const summary = result.ok
      ? `manual fetched=${result.fetched} with_recording=${result.with_recording}`
      : result.error || 'sync failed';
    await markSmartfloRecordingsCronRun({ ok: Boolean(result.ok), summary });

    const extra =
      'days_done' in result && Array.isArray((result as { days_done?: string[] }).days_done)
        ? ` · days ${(result as { days_done: string[] }).days_done.join(', ')}`
        : '';

    return NextResponse.json(
      {
        success: result.ok,
        message: result.ok
          ? `Synced ${result.with_recording} recording(s) from ${result.fetched} CDR row(s)${extra}`
          : result.error || 'Sync failed',
        ...result,
        hours_back: settings.hours_back,
        catch_up: true,
      },
      { status: result.ok ? 200 : 502 },
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Internal server error' },
      { status: 500 },
    );
  }
}
