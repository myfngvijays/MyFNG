import { NextRequest, NextResponse } from 'next/server';
import {
  isNextResponse,
  requireCrmReportsContext,
} from '@/lib/telecaller/crmReportsAuth';
import { resolveReportPeriod } from '@/lib/telecaller/crmReportsRange';
import { resolveCrmPermissionsForUser } from '@/lib/telecaller/resolveCrmPermissions';

export const dynamic = 'force-dynamic';

function csvEscape(v: unknown): string {
  const s = String(v ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(headers: string[], rows: Array<Array<unknown>>): string {
  const lines = [headers.map(csvEscape).join(',')];
  for (const row of rows) lines.push(row.map(csvEscape).join(','));
  return lines.join('\n');
}

/**
 * GET /api/telecaller/crm/reports/export?kind=leads|calls&period=&date=
 * Streams a CSV download for the selected dataset.
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireCrmReportsContext(request);
    if (isNextResponse(ctx)) return ctx;
    const { db, teleCallerId, seesAll, roleCode } = ctx;

    const { permissions } = await resolveCrmPermissionsForUser(db, teleCallerId, roleCode);
    if (!permissions.reports_export) {
      return NextResponse.json(
        { error: 'CSV export is not enabled for your account. Ask your Lead Manager.' },
        { status: 403 },
      );
    }

    const sp = new URL(request.url).searchParams;
    const kind = String(sp.get('kind') || 'leads').toLowerCase();
    const range = resolveReportPeriod(sp.get('period') || 'week', sp.get('date'));
    const stamp = `${range.startYmd}_to_${range.endYmd}`;

    if (kind === 'calls') {
      let q = db
        .from('telecaller_call_logs')
        .select(
          `
          created_at, call_type, call_status, call_duration, outcome, phone_number, notes,
          lead:service_leads!lead_id(lead_number, customer_name, customer_phone, city, status)
        `,
        )
        .gte('created_at', range.start)
        .lte('created_at', range.end)
        .order('created_at', { ascending: false })
        .limit(5000);
      if (!seesAll) q = q.eq('telecaller_id', teleCallerId);
      const { data, error } = await q;
      if (error) throw error;

      const csv = toCsv(
        [
          'created_at',
          'call_type',
          'call_status',
          'duration_sec',
          'outcome',
          'phone',
          'lead_number',
          'customer_name',
          'city',
          'lead_status',
          'notes',
        ],
        (data || []).map((r: any) => [
          r.created_at,
          r.call_type,
          r.call_status,
          r.call_duration,
          r.outcome,
          r.phone_number || r.lead?.customer_phone,
          r.lead?.lead_number,
          r.lead?.customer_name,
          r.lead?.city,
          r.lead?.status,
          r.notes,
        ]),
      );

      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="crm_calls_${stamp}.csv"`,
        },
      });
    }

    // default: leads
    let q = db
      .from('service_leads')
      .select(
        `
        lead_number, customer_name, customer_phone, customer_email, city, status,
        lead_priority, vehicle_make, vehicle_model, vehicle_number, created_at, is_incomplete,
        assigned_telecaller:assigned_telecaller_id(full_name)
      `,
      )
      .is('deleted_at', null)
      .gte('created_at', range.start)
      .lte('created_at', range.end)
      .order('created_at', { ascending: false })
      .limit(5000);
    if (!seesAll) q = q.eq('assigned_telecaller_id', teleCallerId);

    const { data, error } = await q;
    if (error) throw error;

    const csv = toCsv(
      [
        'lead_number',
        'customer_name',
        'phone',
        'email',
        'city',
        'status',
        'priority',
        'make',
        'model',
        'vehicle_number',
        'incomplete',
        'telecaller',
        'created_at',
      ],
      (data || []).map((r: any) => [
        r.lead_number,
        r.customer_name,
        r.customer_phone,
        r.customer_email,
        r.city,
        r.status,
        r.lead_priority,
        r.vehicle_make,
        r.vehicle_model,
        r.vehicle_number,
        r.is_incomplete ? 'yes' : 'no',
        r.assigned_telecaller?.full_name,
        r.created_at,
      ]),
    );

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="crm_leads_${stamp}.csv"`,
      },
    });
  } catch (e: any) {
    console.error('[crm/reports/export]', e);
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 });
  }
}
