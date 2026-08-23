import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getDb, maxRows } from '../db.js';
import { BOOKED_STATUSES, fail, ok, periodRange, sanitizeLead } from '../helpers.js';

export function registerBookingsTools(server: McpServer) {
  server.tool(
    'search_bookings',
    'Search leads in booked/confirmed/in-service/done statuses (real bookings).',
    {
      q: z.string().optional(),
      telecaller_id: z.string().uuid().optional(),
      workshop_id: z.string().uuid().optional(),
      period: z.enum(['day', 'week', 'month', 'year']).optional(),
      date: z.string().optional(),
      limit: z.number().int().min(1).max(100).optional(),
    },
    async (args) => {
      try {
        const db = getDb();
        const lim = maxRows(args.limit);
        const range = periodRange(args.period || 'week', args.date);
        let query = db
          .from('service_leads')
          .select(
            'id, lead_number, customer_name, customer_phone, city, status, assigned_telecaller_id, assigned_workshop_id, updated_at, created_at',
          )
          .in('status', [...BOOKED_STATUSES])
          .gte('updated_at', range.start)
          .lte('updated_at', range.end)
          .order('updated_at', { ascending: false })
          .limit(lim);
        if (args.telecaller_id) {
          query = query.or(
            `assigned_telecaller_id.eq.${args.telecaller_id},created_by_id.eq.${args.telecaller_id}`,
          );
        }
        if (args.workshop_id) query = query.eq('assigned_workshop_id', args.workshop_id);
        if (args.q?.trim()) {
          const needle = args.q.trim();
          const digits = needle.replace(/\D/g, '');
          query = query.or(
            digits.length >= 4
              ? `customer_phone.ilike.%${digits}%,lead_number.ilike.%${needle}%,customer_name.ilike.%${needle}%`
              : `lead_number.ilike.%${needle}%,customer_name.ilike.%${needle}%`,
          );
        }
        const { data, error } = await query;
        if (error) return fail(error.message);
        return ok({
          ok: true,
          range,
          count: data?.length || 0,
          bookings: (data || []).map((r) => sanitizeLead(r as Record<string, unknown>)),
        });
      } catch (e: any) {
        return fail(e?.message || 'search_bookings failed');
      }
    },
  );

  server.tool(
    'get_booking',
    'Get one booking-like lead by id or lead_number.',
    {
      id: z.string().uuid().optional(),
      lead_number: z.string().optional(),
    },
    async ({ id, lead_number }) => {
      try {
        if (!id && !lead_number) return fail('Provide id or lead_number');
        const db = getDb();
        let query = db
          .from('service_leads')
          .select(
            'id, lead_number, customer_name, customer_phone, city, status, assigned_telecaller_id, assigned_workshop_id, created_at, updated_at, coupon_meta',
          )
          .limit(1);
        if (id) query = query.eq('id', id);
        else query = query.eq('lead_number', lead_number!);
        const { data, error } = await query.maybeSingle();
        if (error) return fail(error.message);
        if (!data) return fail('Not found');
        return ok({ ok: true, booking: sanitizeLead(data as Record<string, unknown>) });
      } catch (e: any) {
        return fail(e?.message || 'get_booking failed');
      }
    },
  );

  server.tool(
    'list_workshops',
    'List workshops (id, name, city).',
    {
      city: z.string().optional(),
      q: z.string().optional(),
      limit: z.number().int().min(1).max(100).optional(),
    },
    async ({ city, q, limit }) => {
      try {
        const db = getDb();
        const lim = maxRows(limit);
        let query = db
          .from('workshops')
          .select('id, name, city, phone, is_active, created_at')
          .order('name', { ascending: true })
          .limit(lim);
        if (city) query = query.ilike('city', `%${city}%`);
        if (q?.trim()) query = query.ilike('name', `%${q.trim()}%`);
        const { data, error } = await query;
        if (error) return fail(error.message);
        return ok({
          ok: true,
          count: data?.length || 0,
          workshops: (data || []).map((w) => ({
            ...w,
            phone: w.phone ? String(w.phone).replace(/\d(?=\d{4})/g, '*') : null,
          })),
        });
      } catch (e: any) {
        return fail(e?.message || 'list_workshops failed');
      }
    },
  );

  server.tool(
    'get_job_status',
    'Lookup mechanic_jobs by id or lead_id.',
    {
      job_id: z.string().uuid().optional(),
      lead_id: z.string().uuid().optional(),
      limit: z.number().int().min(1).max(50).optional(),
    },
    async ({ job_id, lead_id, limit }) => {
      try {
        if (!job_id && !lead_id) return fail('Provide job_id or lead_id');
        const db = getDb();
        const lim = maxRows(limit ?? 20);
        let query = db
          .from('mechanic_jobs')
          .select(
            'id, lead_id, workshop_id, mechanic_id, status, created_at, updated_at, started_at, completed_at',
          )
          .order('updated_at', { ascending: false })
          .limit(lim);
        if (job_id) query = query.eq('id', job_id);
        if (lead_id) query = query.eq('lead_id', lead_id);
        const { data, error } = await query;
        if (error) return fail(error.message);
        return ok({ ok: true, count: data?.length || 0, jobs: data || [] });
      } catch (e: any) {
        return fail(e?.message || 'get_job_status failed');
      }
    },
  );
}
