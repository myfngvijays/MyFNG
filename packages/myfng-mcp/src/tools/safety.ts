import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getDb, maxRows } from '../db.js';
import { ALLOWED_TABLES, fail, ok, type AllowedTable } from '../helpers.js';

const TABLE_HINTS: Record<string, string> = {
  service_leads: 'CRM leads / bookings pipeline',
  telecaller_call_logs: 'Outbound/inbound call rows',
  telecaller_call_analyses: 'Call Intelligence scores',
  smartflo_dial_sessions: 'Live Smartflo dialer sessions',
  users_login: 'App users (telecallers, etc.)',
  roles: 'Role codes',
  workshops: 'Workshop directory',
  mechanic_jobs: 'Workshop mechanic jobs',
  crm_lead_statuses: 'Custom CRM statuses',
  crm_lead_tags: 'CRM tags',
};

export function registerSafetyTools(server: McpServer) {
  server.tool(
    'describe_schema',
    'List allowlisted tables this MCP may read (no DDL).',
    {
      table: z.string().optional().describe('Optional single table for a sample column peek'),
    },
    async ({ table }) => {
      try {
        if (!table) {
          return ok({
            ok: true,
            mode: 'readonly',
            tables: ALLOWED_TABLES.map((t) => ({ name: t, about: TABLE_HINTS[t] || '' })),
          });
        }
        const name = table.trim();
        if (!(ALLOWED_TABLES as readonly string[]).includes(name)) {
          return fail(`Table not allowlisted: ${name}`);
        }
        const db = getDb();
        const { data, error } = await db.from(name).select('*').limit(1);
        if (error) return fail(error.message);
        const sample = data?.[0] || null;
        return ok({
          ok: true,
          table: name,
          about: TABLE_HINTS[name] || '',
          columns: sample ? Object.keys(sample) : [],
          sample_keys_only: true,
        });
      } catch (e: any) {
        return fail(e?.message || 'describe_schema failed');
      }
    },
  );

  server.tool(
    'run_readonly_query',
    'Safe filtered SELECT via Supabase: allowlisted table + equality filters only. No raw SQL.',
    {
      table: z.enum(ALLOWED_TABLES as unknown as [AllowedTable, ...AllowedTable[]]),
      filters: z
        .record(z.union([z.string(), z.number(), z.boolean()]))
        .optional()
        .describe('Equality filters, e.g. { status: "NEW" }'),
      columns: z
        .string()
        .optional()
        .describe('Comma-separated columns (default *). No joins.'),
      order_by: z.string().optional(),
      ascending: z.boolean().optional(),
      limit: z.number().int().min(1).max(100).optional(),
    },
    async ({ table, filters, columns, order_by, ascending, limit }) => {
      try {
        if (!(ALLOWED_TABLES as readonly string[]).includes(table)) {
          return fail('Table not allowlisted');
        }
        // Reject anything that looks like SQL injection in column list
        const cols = (columns || '*').trim();
        if (!/^[\w\s,*]+$/.test(cols)) return fail('Invalid columns');
        if (order_by && !/^[\w]+$/.test(order_by)) return fail('Invalid order_by');

        const db = getDb();
        const lim = maxRows(limit);
        let query = db.from(table).select(cols).limit(lim);
        for (const [k, v] of Object.entries(filters || {})) {
          if (!/^[\w]+$/.test(k)) return fail(`Invalid filter key: ${k}`);
          query = query.eq(k, v);
        }
        if (order_by) query = query.order(order_by, { ascending: ascending !== false });
        const { data, error } = await query;
        if (error) return fail(error.message);
        return ok({
          ok: true,
          table,
          count: data?.length || 0,
          rows: data || [],
          note: 'Equality filters only; PII may still appear — prefer dedicated tools when possible.',
        });
      } catch (e: any) {
        return fail(e?.message || 'run_readonly_query failed');
      }
    },
  );
}
