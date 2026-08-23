import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getDb, maxRows } from '../db.js';
import { fail, ok, periodRange, sanitizeLead } from '../helpers.js';

const LEAD_COLS =
  'id, lead_number, customer_name, customer_phone, customer_email, city, status, created_from, created_by_id, assigned_telecaller_id, assigned_workshop_id, created_at, updated_at, last_call_at';

export function registerCrmTools(server: McpServer) {
  server.tool(
    'search_leads',
    'Search service_leads by phone, name, lead number, status, telecaller, or city (read-only).',
    {
      q: z.string().optional().describe('Name, phone digits, or lead number substring'),
      status: z.string().optional(),
      telecaller_id: z.string().uuid().optional(),
      city: z.string().optional(),
      limit: z.number().int().min(1).max(100).optional(),
    },
    async ({ q, status, telecaller_id, city, limit }) => {
      try {
        const db = getDb();
        const lim = maxRows(limit);
        let query = db.from('service_leads').select(LEAD_COLS).order('updated_at', { ascending: false }).limit(lim);
        if (status) query = query.eq('status', status.toUpperCase());
        if (telecaller_id) {
          query = query.or(
            `assigned_telecaller_id.eq.${telecaller_id},created_by_id.eq.${telecaller_id}`,
          );
        }
        if (city) query = query.ilike('city', `%${city}%`);
        if (q?.trim()) {
          const needle = q.trim();
          const digits = needle.replace(/\D/g, '');
          if (digits.length >= 4) {
            query = query.or(
              `customer_phone.ilike.%${digits}%,lead_number.ilike.%${needle}%,customer_name.ilike.%${needle}%`,
            );
          } else {
            query = query.or(`lead_number.ilike.%${needle}%,customer_name.ilike.%${needle}%`);
          }
        }
        const { data, error } = await query;
        if (error) return fail(error.message);
        return ok({
          ok: true,
          count: data?.length || 0,
          leads: (data || []).map((r) => sanitizeLead(r as Record<string, unknown>)),
        });
      } catch (e: any) {
        return fail(e?.message || 'search_leads failed');
      }
    },
  );

  server.tool(
    'get_lead',
    'Fetch one service lead by id or lead_number.',
    {
      id: z.string().uuid().optional(),
      lead_number: z.string().optional(),
    },
    async ({ id, lead_number }) => {
      try {
        if (!id && !lead_number) return fail('Provide id or lead_number');
        const db = getDb();
        let query = db.from('service_leads').select(`${LEAD_COLS}, coupon_meta, notes, address`).limit(1);
        if (id) query = query.eq('id', id);
        else query = query.eq('lead_number', lead_number!);
        const { data, error } = await query.maybeSingle();
        if (error) return fail(error.message);
        if (!data) return fail('Lead not found');
        return ok({ ok: true, lead: sanitizeLead(data as Record<string, unknown>) });
      } catch (e: any) {
        return fail(e?.message || 'get_lead failed');
      }
    },
  );

  server.tool(
    'get_lead_timeline',
    'Call logs + recent activity for a lead (read-only).',
    {
      lead_id: z.string().uuid(),
      limit: z.number().int().min(1).max(100).optional(),
    },
    async ({ lead_id, limit }) => {
      try {
        const db = getDb();
        const lim = maxRows(limit);
        const [leadRes, callsRes] = await Promise.all([
          db.from('service_leads').select(LEAD_COLS).eq('id', lead_id).maybeSingle(),
          db
            .from('telecaller_call_logs')
            .select(
              'id, telecaller_id, call_type, call_status, call_duration, phone_number, notes, created_at, call_recording_url',
            )
            .eq('lead_id', lead_id)
            .order('created_at', { ascending: false })
            .limit(lim),
        ]);
        if (leadRes.error) return fail(leadRes.error.message);
        if (!leadRes.data) return fail('Lead not found');
        return ok({
          ok: true,
          lead: sanitizeLead(leadRes.data as Record<string, unknown>),
          calls: callsRes.data || [],
          calls_error: callsRes.error?.message || null,
        });
      } catch (e: any) {
        return fail(e?.message || 'get_lead_timeline failed');
      }
    },
  );

  server.tool(
    'list_lead_statuses',
    'List CRM lead statuses (crm_lead_statuses) if present; otherwise distinct statuses from recent leads.',
    {},
    async () => {
      try {
        const db = getDb();
        const { data, error } = await db
          .from('crm_lead_statuses')
          .select('id, code, label, color, sort_order, is_active')
          .order('sort_order', { ascending: true })
          .limit(100);
        if (!error && data?.length) {
          return ok({ ok: true, source: 'crm_lead_statuses', statuses: data });
        }
        const recent = await db
          .from('service_leads')
          .select('status')
          .order('updated_at', { ascending: false })
          .limit(500);
        const set = new Set<string>();
        for (const r of recent.data || []) {
          if (r.status) set.add(String(r.status));
        }
        return ok({
          ok: true,
          source: 'service_leads_distinct',
          statuses: [...set].sort().map((code) => ({ code })),
          note: error?.message || undefined,
        });
      } catch (e: any) {
        return fail(e?.message || 'list_lead_statuses failed');
      }
    },
  );

  server.tool(
    'list_duplicates',
    'Find duplicate service_leads sharing the same customer_phone (sample window).',
    {
      limit_phones: z.number().int().min(1).max(50).optional(),
    },
    async ({ limit_phones }) => {
      try {
        const db = getDb();
        const lim = maxRows(limit_phones ?? 30);
        const { data, error } = await db
          .from('service_leads')
          .select('id, lead_number, customer_name, customer_phone, status, created_at')
          .not('customer_phone', 'is', null)
          .order('created_at', { ascending: false })
          .limit(800);
        if (error) return fail(error.message);
        const byPhone = new Map<string, any[]>();
        for (const row of data || []) {
          const digits = String(row.customer_phone || '').replace(/\D/g, '').slice(-10);
          if (digits.length < 10) continue;
          const arr = byPhone.get(digits) || [];
          arr.push(sanitizeLead(row as Record<string, unknown>));
          byPhone.set(digits, arr);
        }
        const groups = [...byPhone.entries()]
          .filter(([, rows]) => rows.length > 1)
          .sort((a, b) => b[1].length - a[1].length)
          .slice(0, lim)
          .map(([phone_tail, leads]) => ({
            phone_tail: maskPiiPhoneTail(phone_tail),
            count: leads.length,
            leads,
          }));
        return ok({ ok: true, groups, scanned: data?.length || 0 });
      } catch (e: any) {
        return fail(e?.message || 'list_duplicates failed');
      }
    },
  );

  server.tool(
    'get_pipeline_summary',
    'Lead funnel counts by status for a period (default last 7 days IST).',
    {
      period: z.enum(['day', 'week', 'month', 'year']).optional(),
      date: z.string().optional().describe('YYYY-MM-DD IST anchor'),
    },
    async ({ period, date }) => {
      try {
        const range = periodRange(period || 'week', date);
        const db = getDb();
        const { data, error } = await db
          .from('service_leads')
          .select('id, status, created_at')
          .gte('created_at', range.start)
          .lte('created_at', range.end)
          .limit(5000);
        if (error) return fail(error.message);
        const byStatus: Record<string, number> = {};
        for (const row of data || []) {
          const st = String(row.status || 'UNKNOWN').toUpperCase();
          byStatus[st] = (byStatus[st] || 0) + 1;
        }
        return ok({
          ok: true,
          range,
          total: data?.length || 0,
          by_status: byStatus,
        });
      } catch (e: any) {
        return fail(e?.message || 'get_pipeline_summary failed');
      }
    },
  );
}

function maskPiiPhoneTail(digits: string) {
  if (digits.length <= 4) return '****';
  return `******${digits.slice(-4)}`;
}
