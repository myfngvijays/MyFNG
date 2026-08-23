import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getDb, maxRows } from '../db.js';
import { fail, ok, periodRange, sanitizeLead, sanitizeUser } from '../helpers.js';

export function registerPeopleTools(server: McpServer) {
  server.tool(
    'list_telecallers',
    'List active TELECALLER users.',
    {
      include_inactive: z.boolean().optional(),
      limit: z.number().int().min(1).max(200).optional(),
    },
    async ({ include_inactive, limit }) => {
      try {
        const db = getDb();
        const lim = Math.min(200, maxRows(limit ?? 100));
        let query = db
          .from('users_login')
          .select('id, full_name, phone, email, is_active, created_at, roles!inner(role_code)')
          .eq('roles.role_code', 'TELECALLER')
          .order('full_name', { ascending: true })
          .limit(lim);
        if (!include_inactive) query = query.eq('is_active', true);
        const { data, error } = await query;
        if (error) return fail(error.message);
        return ok({
          ok: true,
          count: data?.length || 0,
          telecallers: (data || []).map((u) => sanitizeUser(u as Record<string, unknown>)),
        });
      } catch (e: any) {
        return fail(e?.message || 'list_telecallers failed');
      }
    },
  );

  server.tool(
    'get_telecaller',
    'Get one telecaller profile by id.',
    { id: z.string().uuid() },
    async ({ id }) => {
      try {
        const db = getDb();
        const { data, error } = await db
          .from('users_login')
          .select('id, full_name, phone, email, is_active, created_at, last_login_at, roles(role_code)')
          .eq('id', id)
          .maybeSingle();
        if (error) return fail(error.message);
        if (!data) return fail('User not found');
        return ok({ ok: true, telecaller: sanitizeUser(data as Record<string, unknown>) });
      } catch (e: any) {
        return fail(e?.message || 'get_telecaller failed');
      }
    },
  );

  server.tool(
    'get_assignments',
    'Leads currently assigned to a telecaller (or sample of open assignments).',
    {
      telecaller_id: z.string().uuid().optional(),
      status: z.string().optional(),
      limit: z.number().int().min(1).max(100).optional(),
    },
    async ({ telecaller_id, status, limit }) => {
      try {
        const db = getDb();
        const lim = maxRows(limit);
        let query = db
          .from('service_leads')
          .select(
            'id, lead_number, customer_name, customer_phone, city, status, assigned_telecaller_id, assigned_workshop_id, updated_at',
          )
          .not('assigned_telecaller_id', 'is', null)
          .order('updated_at', { ascending: false })
          .limit(lim);
        if (telecaller_id) query = query.eq('assigned_telecaller_id', telecaller_id);
        if (status) query = query.eq('status', status.toUpperCase());
        const { data, error } = await query;
        if (error) return fail(error.message);
        return ok({
          ok: true,
          count: data?.length || 0,
          leads: (data || []).map((r) => sanitizeLead(r as Record<string, unknown>)),
        });
      } catch (e: any) {
        return fail(e?.message || 'get_assignments failed');
      }
    },
  );

  server.tool(
    'get_shift_summary',
    'Rough shift snapshot for today IST: dials, answered, unique leads touched per telecaller.',
    {
      date: z.string().optional(),
      telecaller_id: z.string().uuid().optional(),
    },
    async ({ date, telecaller_id }) => {
      try {
        const range = periodRange('day', date);
        const db = getDb();
        let query = db
          .from('telecaller_call_logs')
          .select('telecaller_id, lead_id, call_status, call_duration, created_at')
          .gte('created_at', range.start)
          .lte('created_at', range.end)
          .limit(6000);
        if (telecaller_id) query = query.eq('telecaller_id', telecaller_id);
        const { data, error } = await query;
        if (error) return fail(error.message);

        type Row = {
          calls: number;
          answered: number;
          leads: Set<string>;
          first?: string;
          last?: string;
        };
        const map = new Map<string, Row>();
        for (const c of data || []) {
          const id = String(c.telecaller_id || '');
          if (!id) continue;
          let r = map.get(id);
          if (!r) {
            r = { calls: 0, answered: 0, leads: new Set() };
            map.set(id, r);
          }
          r.calls += 1;
          const dur = Number(c.call_duration) || 0;
          const st = String(c.call_status || '').toUpperCase();
          if (dur >= 1 || st === 'ANSWERED' || st === 'COMPLETED' || st === 'CONNECTED') r.answered += 1;
          if (c.lead_id) r.leads.add(String(c.lead_id));
          const at = String(c.created_at || '');
          if (at && (!r.first || at < r.first)) r.first = at;
          if (at && (!r.last || at > r.last)) r.last = at;
        }

        const ids = [...map.keys()];
        const names: Record<string, string> = {};
        if (ids.length) {
          const { data: users } = await db.from('users_login').select('id, full_name').in('id', ids);
          for (const u of users || []) names[String(u.id)] = String(u.full_name || 'Telecaller');
        }

        const rows = [...map.entries()]
          .map(([id, r]) => ({
            telecaller_id: id,
            full_name: names[id] || 'Telecaller',
            calls: r.calls,
            answered: r.answered,
            leads_touched: r.leads.size,
            first_call_at: r.first || null,
            last_call_at: r.last || null,
          }))
          .sort((a, b) => b.calls - a.calls);

        return ok({ ok: true, range, agents: rows });
      } catch (e: any) {
        return fail(e?.message || 'get_shift_summary failed');
      }
    },
  );
}
