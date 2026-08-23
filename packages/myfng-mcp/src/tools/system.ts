import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getDb } from '../db.js';
import { fail, ok } from '../helpers.js';

async function pingTable(table: string) {
  const db = getDb();
  const started = Date.now();
  const { error, count } = await db.from(table).select('*', { count: 'exact', head: true });
  return {
    table,
    ok: !error,
    ms: Date.now() - started,
    count: count ?? null,
    error: error?.message || null,
  };
}

export function registerSystemTools(server: McpServer) {
  server.tool(
    'get_system_monitor',
    'Lightweight read-only health: critical tables reachable + row counts.',
    {},
    async () => {
      try {
        const tables = [
          'service_leads',
          'telecaller_call_logs',
          'telecaller_call_analyses',
          'smartflo_dial_sessions',
          'users_login',
          'workshops',
          'mechanic_jobs',
        ];
        const checks = [];
        for (const t of tables) {
          checks.push(await pingTable(t));
        }
        const down = checks.filter((c) => !c.ok);
        const status = down.length === 0 ? 'healthy' : down.length <= 2 ? 'degraded' : 'down';
        return ok({
          ok: true,
          status,
          checked_at: new Date().toISOString(),
          checks,
        });
      } catch (e: any) {
        return fail(e?.message || 'get_system_monitor failed');
      }
    },
  );

  server.tool(
    'check_env_status',
    'Report which MCP env keys are present (never returns secret values).',
    {},
    async () => {
      const keys = [
        'SUPABASE_URL',
        'NEXT_PUBLIC_SUPABASE_URL',
        'SUPABASE_SERVICE_ROLE_KEY',
        'SUPABASE_SERVICE_KEY',
        'MYFNG_MCP_MASK_PII',
        'MYFNG_MCP_MAX_ROWS',
      ];
      const env: Record<string, { present: boolean; length?: number }> = {};
      for (const k of keys) {
        const v = process.env[k];
        env[k] = v ? { present: true, length: v.length } : { present: false };
      }
      const hasUrl = Boolean(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL);
      const hasKey = Boolean(
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY,
      );
      return ok({
        ok: true,
        ready: hasUrl && hasKey,
        mask_pii: process.env.MYFNG_MCP_MASK_PII ?? 'true',
        env,
      });
    },
  );

  server.tool(
    'list_recent_errors',
    'Best-effort recent failure signals: failed/missed calls + dial sessions stuck open.',
    {
      hours: z.number().int().min(1).max(168).optional(),
      limit: z.number().int().min(1).max(50).optional(),
    },
    async ({ hours, limit }) => {
      try {
        const db = getDb();
        const h = hours ?? 24;
        const lim = limit ?? 25;
        const since = new Date(Date.now() - h * 60 * 60 * 1000).toISOString();

        const [failedCalls, openSessions] = await Promise.all([
          db
            .from('telecaller_call_logs')
            .select('id, telecaller_id, call_status, call_duration, phone_number, created_at, lead_id')
            .gte('created_at', since)
            .in('call_status', ['FAILED', 'BUSY', 'NO_ANSWER', 'MISSED', 'CANCELLED', 'SWITCHED_OFF'])
            .order('created_at', { ascending: false })
            .limit(lim),
          db
            .from('smartflo_dial_sessions')
            .select('id, telecaller_id, status, started_at, customer_phone, lead_id')
            .gte('started_at', since)
            .in('status', ['RINGING', 'DIALING', 'INITIATED', 'OPEN'])
            .order('started_at', { ascending: false })
            .limit(lim),
        ]);

        return ok({
          ok: true,
          since,
          failed_or_missed_calls: {
            error: failedCalls.error?.message || null,
            rows: failedCalls.data || [],
          },
          open_dial_sessions: {
            error: openSessions.error?.message || null,
            rows: openSessions.data || [],
          },
          note: 'Not a full app error log — DB-derived ops signals only.',
        });
      } catch (e: any) {
        return fail(e?.message || 'list_recent_errors failed');
      }
    },
  );
}
