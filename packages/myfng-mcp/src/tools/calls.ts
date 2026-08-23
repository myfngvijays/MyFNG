import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getDb, maxRows } from '../db.js';
import { fail, ok, periodRange, sanitizeCall, sanitizeUser } from '../helpers.js';

const CALL_COLS =
  'id, lead_id, telecaller_id, call_type, call_status, call_duration, phone_number, notes, call_recording_url, smartflo_call_id, created_at';

export function registerCallsTools(server: McpServer) {
  server.tool(
    'search_call_logs',
    'Search telecaller_call_logs (read-only). Filter by telecaller, status, type, lead, phone, date range.',
    {
      telecaller_id: z.string().uuid().optional(),
      lead_id: z.string().uuid().optional(),
      status: z.string().optional(),
      call_type: z.string().optional(),
      phone: z.string().optional(),
      period: z.enum(['day', 'week', 'month', 'year']).optional(),
      date: z.string().optional(),
      limit: z.number().int().min(1).max(100).optional(),
    },
    async (args) => {
      try {
        const db = getDb();
        const lim = maxRows(args.limit);
        const range = periodRange(args.period || 'day', args.date);
        let query = db
          .from('telecaller_call_logs')
          .select(CALL_COLS)
          .gte('created_at', range.start)
          .lte('created_at', range.end)
          .order('created_at', { ascending: false })
          .limit(lim);
        if (args.telecaller_id) query = query.eq('telecaller_id', args.telecaller_id);
        if (args.lead_id) query = query.eq('lead_id', args.lead_id);
        if (args.status) query = query.ilike('call_status', args.status);
        if (args.call_type) query = query.ilike('call_type', args.call_type);
        if (args.phone) {
          const digits = args.phone.replace(/\D/g, '');
          if (digits) query = query.ilike('phone_number', `%${digits}%`);
        }
        const { data, error } = await query;
        if (error) return fail(error.message);
        return ok({
          ok: true,
          range,
          count: data?.length || 0,
          calls: (data || []).map((r) => sanitizeCall(r as Record<string, unknown>)),
        });
      } catch (e: any) {
        return fail(e?.message || 'search_call_logs failed');
      }
    },
  );

  server.tool(
    'get_call',
    'Fetch one call log by id.',
    { id: z.string().uuid() },
    async ({ id }) => {
      try {
        const db = getDb();
        const { data, error } = await db
          .from('telecaller_call_logs')
          .select(`${CALL_COLS}, raw_payload`)
          .eq('id', id)
          .maybeSingle();
        if (error) return fail(error.message);
        if (!data) return fail('Call not found');
        const { raw_payload: _rp, ...rest } = data as any;
        return ok({
          ok: true,
          call: sanitizeCall(rest),
          has_raw_payload: Boolean(_rp),
        });
      } catch (e: any) {
        return fail(e?.message || 'get_call failed');
      }
    },
  );

  server.tool(
    'get_recordings',
    'List call logs that have a recording URL in a period.',
    {
      telecaller_id: z.string().uuid().optional(),
      period: z.enum(['day', 'week', 'month', 'year']).optional(),
      date: z.string().optional(),
      limit: z.number().int().min(1).max(100).optional(),
    },
    async ({ telecaller_id, period, date, limit }) => {
      try {
        const db = getDb();
        const lim = maxRows(limit);
        const range = periodRange(period || 'week', date);
        let query = db
          .from('telecaller_call_logs')
          .select(CALL_COLS)
          .not('call_recording_url', 'is', null)
          .neq('call_recording_url', '')
          .gte('created_at', range.start)
          .lte('created_at', range.end)
          .order('created_at', { ascending: false })
          .limit(lim);
        if (telecaller_id) query = query.eq('telecaller_id', telecaller_id);
        const { data, error } = await query;
        if (error) return fail(error.message);
        return ok({
          ok: true,
          range,
          count: data?.length || 0,
          recordings: (data || []).map((r) => sanitizeCall(r as Record<string, unknown>)),
        });
      } catch (e: any) {
        return fail(e?.message || 'get_recordings failed');
      }
    },
  );

  server.tool(
    'get_call_intelligence',
    'Fetch telecaller_call_analyses (Call Intelligence) by call_log_id or recent analyses.',
    {
      call_log_id: z.string().uuid().optional(),
      limit: z.number().int().min(1).max(100).optional(),
    },
    async ({ call_log_id, limit }) => {
      try {
        const db = getDb();
        if (call_log_id) {
          const { data, error } = await db
            .from('telecaller_call_analyses')
            .select('*')
            .eq('call_log_id', call_log_id)
            .maybeSingle();
          if (error) return fail(error.message);
          if (!data) return fail('No analysis for this call (run Call Intelligence or migration 339)');
          return ok({ ok: true, analysis: data });
        }
        const lim = maxRows(limit);
        const { data, error } = await db
          .from('telecaller_call_analyses')
          .select(
            'id, call_log_id, sentiment, quality_score, quality_grade, buying_intent, summary, analyzed_at',
          )
          .order('analyzed_at', { ascending: false })
          .limit(lim);
        if (error) return fail(error.message);
        return ok({ ok: true, count: data?.length || 0, analyses: data || [] });
      } catch (e: any) {
        return fail(e?.message || 'get_call_intelligence failed');
      }
    },
  );

  server.tool(
    'get_dial_sessions',
    'List smartflo_dial_sessions (live dialer sessions).',
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
          .from('smartflo_dial_sessions')
          .select(
            'id, telecaller_id, lead_id, customer_phone, status, started_at, answered_at, ended_at, duration_seconds, smartflo_call_id, call_log_id',
          )
          .order('started_at', { ascending: false })
          .limit(lim);
        if (telecaller_id) query = query.eq('telecaller_id', telecaller_id);
        if (status) query = query.eq('status', status);
        const { data, error } = await query;
        if (error) return fail(error.message);
        return ok({
          ok: true,
          count: data?.length || 0,
          sessions: (data || []).map((r) => sanitizeCall(r as Record<string, unknown>)),
        });
      } catch (e: any) {
        return fail(e?.message || 'get_dial_sessions failed');
      }
    },
  );

  server.tool(
    'get_telecaller_activity',
    'Day activity for one telecaller: calls summary + last calls.',
    {
      telecaller_id: z.string().uuid(),
      date: z.string().optional(),
      limit: z.number().int().min(1).max(100).optional(),
    },
    async ({ telecaller_id, date, limit }) => {
      try {
        const db = getDb();
        const lim = maxRows(limit);
        const range = periodRange('day', date);
        const [userRes, callsRes] = await Promise.all([
          db
            .from('users_login')
            .select('id, full_name, phone, email, is_active, roles(role_code)')
            .eq('id', telecaller_id)
            .maybeSingle(),
          db
            .from('telecaller_call_logs')
            .select(CALL_COLS)
            .eq('telecaller_id', telecaller_id)
            .gte('created_at', range.start)
            .lte('created_at', range.end)
            .order('created_at', { ascending: false })
            .limit(lim),
        ]);
        if (userRes.error) return fail(userRes.error.message);
        const calls = callsRes.data || [];
        let answered = 0;
        let talk = 0;
        for (const c of calls) {
          const dur = Number(c.call_duration) || 0;
          talk += dur;
          const st = String(c.call_status || '').toUpperCase();
          if (dur >= 1 || st === 'ANSWERED' || st === 'COMPLETED' || st === 'CONNECTED') answered += 1;
        }
        return ok({
          ok: true,
          range,
          telecaller: userRes.data
            ? sanitizeUser(userRes.data as Record<string, unknown>)
            : { id: telecaller_id },
          summary: {
            calls: calls.length,
            answered,
            talk_seconds: talk,
            connect_rate: calls.length ? answered / calls.length : 0,
          },
          recent_calls: calls.map((r) => sanitizeCall(r as Record<string, unknown>)),
          calls_error: callsRes.error?.message || null,
        });
      } catch (e: any) {
        return fail(e?.message || 'get_telecaller_activity failed');
      }
    },
  );
}
