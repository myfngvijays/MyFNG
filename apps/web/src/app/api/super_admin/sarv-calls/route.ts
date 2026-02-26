import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function assertSuperAdmin(supabase: any) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return { ok: false, status: 401, error: 'Unauthorized', user: null };
  }

  const { data: userData, error: roleError } = await supabase
    .from('users_login')
    .select('id, roles!inner(role_code)')
    .eq('id', user.id)
    .single();
  if (roleError || !userData) {
    return { ok: false, status: 403, error: 'Forbidden - Role check failed', user };
  }
  const roleCode = (userData as any).roles?.role_code;
  if (!['SUPER_ADMIN', 'SUB_ADMIN'].includes(roleCode)) {
    return { ok: false, status: 403, error: 'Forbidden - Not super admin', user };
  }
  return { ok: true, status: 200, error: null, user };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function normalizePincode(value?: string | null) {
  return String(value || '').replace(/\D/g, '').slice(0, 10);
}

function deriveCityFromAddress(address?: string | null) {
  const parts = String(address || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length >= 2) return parts[parts.length - 2];
  return '';
}

function chunkArray<T>(list: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) {
    out.push(list.slice(i, i + size));
  }
  return out;
}

function digits10(value?: string | null) {
  const d = String(value || '').replace(/\D/g, '');
  if (!d) return '';
  return d.length <= 10 ? d : d.slice(-10);
}

function getISTParts(value?: string | Date | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || '';
  const year = get('year');
  const month = get('month');
  const day = get('day');
  const hour = get('hour');
  if (!year || !month || !day || !hour) return null;
  return { dayKey: `${year}-${month}-${day}`, hourKey: `${year}-${month}-${day} ${hour}:00` };
}

function incrementCount(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) || 0) + 1);
}

function normalizeCallType(value?: string | null) {
  const raw = String(value || '').trim().toUpperCase();
  if (!raw) return 'Unknown';
  if (raw === 'IBD' || raw === 'INBOUND' || raw === 'IN') return 'Inbound';
  if (raw === 'OBD' || raw === 'OUTBOUND' || raw === 'OUT') return 'Outbound';
  if (raw === 'MISSED') return 'Missed';
  if (raw === 'IVR') return 'IVR';
  return raw;
}

function toISTBucketLabel(dateValue: string | Date, bucketMinutes: number): string | null {
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (!Number.isFinite(date.getTime())) return null;

  const offsetMs = 330 * 60 * 1000;
  const bucketMs = Math.max(1, bucketMinutes) * 60 * 1000;
  const istMs = date.getTime() + offsetMs;
  const flooredIstMs = Math.floor(istMs / bucketMs) * bucketMs;
  const flooredUtcMs = flooredIstMs - offsetMs;
  const flooredDate = new Date(flooredUtcMs);

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(flooredDate);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || '';
  const yyyy = get('year');
  const mm = get('month');
  const dd = get('day');
  const hh = get('hour');
  const min = get('minute');
  if (!yyyy || !mm || !dd) return null;
  if (bucketMinutes >= 1440) return `${yyyy}-${mm}-${dd}`;
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = await assertSuperAdmin(supabase);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: adminError || 'Admin client not configured' }, { status: 500 });
    }
    const db = supabaseAdmin as any;

    const { searchParams } = new URL(request.url);
    const now = new Date();
    const defaultFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const from = searchParams.get('from') || defaultFrom.toISOString();
    const to = searchParams.get('to') || now.toISOString();

    const assigneeRole = (searchParams.get('assignee_role') || '').toUpperCase();
    const assigneeId = searchParams.get('assignee_id') || '';
    const hasRecording = searchParams.get('has_recording');
    const q = (searchParams.get('q') || '').trim();
    const includeOverview = searchParams.get('include_overview') === 'true';
    const allRowsMode = searchParams.get('all_rows') === 'true';
    const dispositionFilter = String(searchParams.get('disposition') || '').trim();
    const cityFilter = String(searchParams.get('city') || '').trim();
    const allowedBuckets = new Set([15, 30, 60, 240, 480, 720, 1440]);
    const parsedFlowBucket = Number(searchParams.get('flow_bucket') || 1440);
    const flowBucketMinutes = allowedBuckets.has(parsedFlowBucket) ? parsedFlowBucket : 1440;
    if (assigneeRole && !['TELECALLER', 'RSA_MANAGER'].includes(assigneeRole)) {
      return NextResponse.json({ error: 'Invalid assignee_role filter' }, { status: 400 });
    }

    const limit = clamp(Number(searchParams.get('limit') || 50), 1, 200);
    const page = clamp(Number(searchParams.get('page') || 1), 1, 100000);
    const fromIndex = (page - 1) * limit;
    const toIndex = fromIndex + limit - 1;

    const applyReportFilters = (query: any) => {
      let next = query.gte('created_at', from).lte('created_at', to);
      if (assigneeRole) {
        next = next.eq('assigned_role', assigneeRole);
      }
      if (assigneeId) {
        next = next.eq('assigned_user_id', assigneeId);
      }
      if (hasRecording === 'true') {
        next = next.not('recording_url', 'is', null);
      }
      if (hasRecording === 'false') {
        next = next.is('recording_url', null);
      }
      if (q) {
        next = next.or(`callid.ilike.%${q}%,cnumber.ilike.%${q}%`);
      }
      return next;
    };

    const baseSelect = `
      id,
      callid,
      cnumber,
      did,
      callstatus,
      ctype,
      ivrstime,
      ivretime,
      ivrduration,
      talkduration,
      agentoncallduration,
      custanswerstime,
      custansweretime,
      custanswerduration,
      recording_url,
      transcription,
      summary,
      disposition,
      disposition_category,
      disposition_note,
      disposition_updated_at,
      sarv_created_at,
      created_at,
      assigned_user_id,
      assigned_role
    `;

    let totalCount = 0;
    let rows: any[] = [];
    if (allRowsMode) {
      const pageSize = 1000;
      let offset = 0;
      let expected: number | null = null;
      while (true) {
        const qPage = applyReportFilters(
          db
            .from('sarv_calls')
            .select(baseSelect, { count: offset === 0 ? 'exact' : undefined })
            .order('created_at', { ascending: false })
            .range(offset, offset + pageSize - 1)
        );
        const { data, error, count } = await qPage;
        if (error) {
          return NextResponse.json({ error: 'Failed to fetch SARV calls' }, { status: 500 });
        }
        if (offset === 0) expected = typeof count === 'number' ? count : null;
        const batch = Array.isArray(data) ? data : [];
        rows.push(...batch);
        if (batch.length < pageSize) break;
        offset += pageSize;
        if (expected != null && rows.length >= expected) break;
        if (offset > 1000000) break;
      }
      totalCount = rows.length;
    } else {
      const query = applyReportFilters(
        db
          .from('sarv_calls')
          .select(baseSelect, { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(fromIndex, toIndex)
      );
      const { data: calls, error, count } = await query;
      if (error) {
        return NextResponse.json({ error: 'Failed to fetch SARV calls' }, { status: 500 });
      }
      rows = Array.isArray(calls) ? calls : [];
      totalCount = Number(count || 0);
    }
    const assigneeIds = Array.from(new Set(rows.map((r: any) => r?.assigned_user_id).filter(Boolean)));
    let assigneeMap = new Map<string, any>();
    if (assigneeIds.length) {
      const { data: users } = await db
        .from('users_login')
        .select('id, full_name, email, phone')
        .in('id', assigneeIds);
      for (const u of users || []) {
        assigneeMap.set(u.id, u);
      }
    }

    const callIds = rows.map((row: any) => String(row?.id || '')).filter(Boolean);
    let latestAuditByCallId: Record<string, any> = {};
    if (callIds.length) {
      const { data: audits } = await db
        .from('sarv_call_audits')
        .select('id, sarv_call_id, audit_status, audit_score, feedback, audited_by_id, audited_at, updated_at, created_at')
        .in('sarv_call_id', callIds)
        .order('updated_at', { ascending: false });

      if (Array.isArray(audits)) {
        for (const audit of audits) {
          const key = String((audit as any)?.sarv_call_id || '').trim();
          if (!key || latestAuditByCallId[key]) continue;
          latestAuditByCallId[key] = audit;
        }
      }
    }

    const enriched = rows.map((row: any) => {
      const user = row.assigned_user_id ? assigneeMap.get(row.assigned_user_id) : null;
      return {
        ...row,
        assignee_name: user?.full_name || null,
        assignee_email: user?.email || null,
        assignee_phone: user?.phone || null,
      };
    });

    const buildCityByCallId = async (ids: string[]) => {
      const cityByCallId = new Map<string, string>();
      if (!ids.length) return cityByCallId;

      const linkRows: any[] = [];
      for (const idChunk of chunkArray(ids, 500)) {
        const { data } = await db
          .from('sarv_call_rsa_links')
          .select('sarv_call_id, rsa_lead_id')
          .in('sarv_call_id', idChunk);
        if (Array.isArray(data)) linkRows.push(...data);
      }

      const leadIds = Array.from(
        new Set((linkRows || []).map((row: any) => String(row?.rsa_lead_id || '').trim()).filter(Boolean))
      );

      const leadById = new Map<string, any>();
      if (leadIds.length) {
        for (const leadChunk of chunkArray(leadIds, 500)) {
          const { data: leadRows } = await db
            .from('rsa_leads')
            .select('id, pincode, address')
            .in('id', leadChunk);
          for (const lead of leadRows || []) {
            const key = String((lead as any)?.id || '').trim();
            if (key) leadById.set(key, lead);
          }
        }
      }

      const pincodes = Array.from(
        new Set(
          Array.from(leadById.values())
            .map((lead: any) => normalizePincode(lead?.pincode))
            .filter(Boolean)
        )
      );
      const districtByPincode = new Map<string, string>();
      if (pincodes.length) {
        for (const pinChunk of chunkArray(pincodes, 500)) {
          const { data: pincodeRows } = await db
            .from('pincode_city_state')
            .select('pincode, district')
            .in('pincode', pinChunk);
          for (const row of pincodeRows || []) {
            const pin = normalizePincode((row as any)?.pincode);
            const district = String((row as any)?.district || '').trim();
            if (pin && district) districtByPincode.set(pin, district);
          }
        }
      }

      for (const link of linkRows || []) {
        const callId = String((link as any)?.sarv_call_id || '').trim();
        if (!callId || cityByCallId.has(callId)) continue;
        const leadId = String((link as any)?.rsa_lead_id || '').trim();
        const lead = leadById.get(leadId);
        if (!lead) continue;
        const pin = normalizePincode(lead?.pincode);
        const fromPin = pin ? districtByPincode.get(pin) : '';
        const fromAddress = deriveCityFromAddress(lead?.address);
        const city = fromPin || fromAddress || '';
        if (city) cityByCallId.set(callId, city);
      }
      return cityByCallId;
    };

    const cityByCallId = await buildCityByCallId(callIds);

    const buildCityByPhone = async () => {
      const dateFilter = `or(and(lead_registered_at.gte.${from},lead_registered_at.lte.${to}),and(requested_at.gte.${from},requested_at.lte.${to}))`;
      const { data: leadRows } = await db
        .from('rsa_leads')
        .select('contact_number, alternate_number, pincode, address')
        .eq('delete_status', false)
        .or(dateFilter);

      const pins = Array.from(
        new Set(
          (leadRows || [])
            .map((lead: any) => normalizePincode(lead?.pincode))
            .filter(Boolean)
        )
      );
      const districtByPincode = new Map<string, string>();
      for (const pinChunk of chunkArray(pins, 500)) {
        const { data: pincodeRows } = await db
          .from('pincode_city_state')
          .select('pincode, district')
          .in('pincode', pinChunk);
        for (const row of pincodeRows || []) {
          const pin = normalizePincode((row as any)?.pincode);
          const district = String((row as any)?.district || '').trim();
          if (pin && district) districtByPincode.set(pin, district);
        }
      }

      const cityByPhone = new Map<string, string>();
      for (const lead of leadRows || []) {
        const pin = normalizePincode((lead as any)?.pincode);
        const city = (pin ? districtByPincode.get(pin) : '') || deriveCityFromAddress((lead as any)?.address) || '';
        if (!city) continue;
        const p1 = digits10((lead as any)?.contact_number);
        const p2 = digits10((lead as any)?.alternate_number);
        if (p1 && !cityByPhone.has(p1)) cityByPhone.set(p1, city);
        if (p2 && !cityByPhone.has(p2)) cityByPhone.set(p2, city);
      }
      return cityByPhone;
    };

    const cityByPhone = await buildCityByPhone();
    for (const row of enriched as any[]) {
      const key = String(row?.id || '').trim();
      const byLink = cityByCallId.get(key) || '';
      const byPhone = cityByPhone.get(digits10((row as any)?.cnumber)) || '';
      row.city = byLink || byPhone || null;
    }

    let filteredEnriched = enriched as any[];
    if (dispositionFilter) {
      const target = dispositionFilter.toLowerCase();
      filteredEnriched = filteredEnriched.filter((row: any) => {
        const d = String(row?.disposition || '').trim().toLowerCase();
        const c = String(row?.disposition_category || '').trim().toLowerCase();
        if (target === 'unspecified') return !d && !c;
        return d === target || c === target;
      });
    }
    if (cityFilter) {
      const target = cityFilter.toLowerCase();
      filteredEnriched = filteredEnriched.filter((row: any) => {
        const city = String(row?.city || '').trim();
        if (target === 'unknown') return !city;
        return city.toLowerCase() === target;
      });
    }

    let overview: any = null;
    if (includeOverview) {
      const allRows: any[] = [];
      const pageSize = 1000;
      let offset = 0;
      let totalExpected: number | null = null;
      let summaryError: any = null;

      while (true) {
        const pageQuery = applyReportFilters(
          db
            .from('sarv_calls')
            .select('id, cnumber, did, ctype, disposition, disposition_category, created_at, assigned_user_id', { count: offset === 0 ? 'exact' : undefined })
            .order('created_at', { ascending: false })
            .range(offset, offset + pageSize - 1)
        );
        const { data, error, count: pageCount } = await pageQuery;
        if (error) {
          summaryError = error;
          break;
        }
        if (offset === 0 && typeof pageCount === 'number') totalExpected = pageCount;
        const batch = Array.isArray(data) ? data : [];
        allRows.push(...batch);
        if (batch.length < pageSize) break;
        offset += pageSize;
        if (totalExpected != null && allRows.length >= totalExpected) break;
        if (offset > 1000000) break;
      }

      if (!summaryError) {
        const allIds = allRows.map((r: any) => String(r?.id || '')).filter(Boolean);
        const allCityByCallId = await buildCityByCallId(allIds);
        const dispositionCounts = new Map<string, number>();
        const cityCounts = new Map<string, number>();
        const didCounts = new Map<string, number>();
        const employeeCounts = new Map<string, number>();
        const flowCounts = new Map<string, number>();
        const flowTypeCounts = new Map<string, Map<string, number>>();
        const customerSet = new Set<string>();
        const overviewAssigneeIds = Array.from(
          new Set(
            allRows
              .map((r: any) => String(r?.assigned_user_id || '').trim())
              .filter(Boolean)
          )
        );
        const overviewAssigneeLabelById = new Map<string, string>();
        if (overviewAssigneeIds.length > 0) {
          const { data: assignees } = await db
            .from('users_login')
            .select('id, full_name, email')
            .in('id', overviewAssigneeIds);
          for (const row of assignees || []) {
            const id = String((row as any)?.id || '').trim();
            const label =
              String((row as any)?.full_name || '').trim() ||
              String((row as any)?.email || '').trim() ||
              id;
            if (id && label) overviewAssigneeLabelById.set(id, label);
          }
        }
        for (const row of allRows) {
          const customer = String((row as any)?.cnumber || '').trim();
          if (customer) customerSet.add(customer);
          const disposition = String((row as any)?.disposition || (row as any)?.disposition_category || '').trim() || 'Unspecified';
          incrementCount(dispositionCounts, disposition);
          const did = String((row as any)?.did || '').trim() || 'Unknown';
          incrementCount(didCounts, did);
          const assigneeId = String((row as any)?.assigned_user_id || '').trim();
          const assigneeLabel = (assigneeId ? overviewAssigneeLabelById.get(assigneeId) : '') || 'Unassigned';
          incrementCount(employeeCounts, assigneeLabel);
          const callId = String((row as any)?.id || '').trim();
          const city =
            allCityByCallId.get(callId) ||
            cityByPhone.get(digits10((row as any)?.cnumber)) ||
            'Unknown';
          incrementCount(cityCounts, city);
          const bucket = toISTBucketLabel((row as any)?.created_at, flowBucketMinutes);
          if (bucket) {
            incrementCount(flowCounts, bucket);
            const byType = flowTypeCounts.get(bucket) || new Map<string, number>();
            incrementCount(byType, normalizeCallType((row as any)?.ctype));
            flowTypeCounts.set(bucket, byType);
          }
        }
        const toRows = (map: Map<string, number>) =>
          Array.from(map.entries())
            .map(([name, total]) => ({ name, total }))
            .sort((a, b) => b.total - a.total);
        const callFlow = Array.from(flowCounts.entries())
          .map(([bucket, total]) => {
            const typeMap = flowTypeCounts.get(bucket) || new Map<string, number>();
            const call_types = Array.from(typeMap.entries())
              .map(([name, count]) => ({
                name,
                total: count,
                percent: total > 0 ? Number(((count * 100) / total).toFixed(1)) : 0,
              }))
              .sort((a, b) => b.total - a.total);
            return { bucket, total, call_types };
          })
          .sort((a, b) => a.bucket.localeCompare(b.bucket));
        overview = {
          totalCalls: allRows.length,
          totalCustomers: customerSet.size,
          dispositions: toRows(dispositionCounts),
          dids: toRows(didCounts),
          employees: toRows(employeeCounts),
          cities: toRows(cityCounts),
          call_flow: {
            granularity: 'bucket',
            bucket_minutes: flowBucketMinutes,
            points: callFlow,
          },
        };
      }
    }

    return NextResponse.json({
      calls: filteredEnriched,
      audits: latestAuditByCallId,
      pagination: {
        page,
        limit,
        total: allRowsMode ? filteredEnriched.length : totalCount,
      },
      overview,
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal server error', details: error?.message }, { status: 500 });
  }
}
