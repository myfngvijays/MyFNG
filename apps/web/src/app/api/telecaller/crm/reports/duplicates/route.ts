import { NextRequest, NextResponse } from 'next/server';
import {
  isNextResponse,
  requireCrmReportsContext,
} from '@/lib/telecaller/crmReportsAuth';
import { normalizePhoneKey } from '@/lib/telecaller/crmReportsRange';
import { resolveCrmPermissionsForUser } from '@/lib/telecaller/resolveCrmPermissions';

export const dynamic = 'force-dynamic';

/**
 * Duplicate phones — lean select, no joins; group in memory.
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireCrmReportsContext(request);
    if (isNextResponse(ctx)) return ctx;
    const { db, teleCallerId, seesAll, roleCode } = ctx;

    const { permissions } = await resolveCrmPermissionsForUser(db, teleCallerId, roleCode);
    if (!permissions.reports_duplicates) {
      return NextResponse.json(
        { error: 'Duplicates report is not enabled for your account.' },
        { status: 403 },
      );
    }

    const sp = new URL(request.url).searchParams;
    const channel = String(sp.get('channel') || 'phone').toLowerCase();
    if (channel !== 'phone') {
      return NextResponse.json({ error: 'Only phone duplicates supported for now' }, { status: 400 });
    }

    let q = db
      .from('service_leads')
      .select('id, lead_number, customer_name, customer_phone, status, city, created_at, is_incomplete')
      .is('deleted_at', null)
      .not('customer_phone', 'is', null)
      .order('created_at', { ascending: false })
      .limit(2500);

    if (!seesAll) q = q.eq('assigned_telecaller_id', teleCallerId);

    const { data, error } = await q;
    if (error) throw error;

    const groups = new Map<string, { key: string; display: string; leads: any[] }>();

    for (const row of data || []) {
      const key = normalizePhoneKey(row.customer_phone);
      if (key.length < 8) continue;
      const g = groups.get(key) || {
        key,
        display: String(row.customer_phone || key),
        leads: [],
      };
      // Cap leads kept per group to keep payload small
      if (g.leads.length < 25) {
        g.leads.push({
          id: row.id,
          lead_number: row.lead_number,
          customer_name: row.customer_name,
          customer_phone: row.customer_phone,
          status: row.status,
          city: row.city,
          created_at: row.created_at,
          is_incomplete: row.is_incomplete,
          telecaller_name: null,
        });
      } else {
        // still count via pushing placeholder length — track separately
        (g as any)._extra = ((g as any)._extra || 0) + 1;
      }
      groups.set(key, g);
    }

    const duplicates = Array.from(groups.values())
      .map((g) => ({
        key: g.key,
        phone: g.display,
        count: g.leads.length + Number((g as any)._extra || 0),
        leads: g.leads,
      }))
      .filter((g) => g.count > 1)
      .sort((a, b) => b.count - a.count || a.phone.localeCompare(b.phone))
      .slice(0, 200);

    return NextResponse.json(
      {
        ok: true,
        channel: 'phone',
        total_groups: duplicates.length,
        total_extra_leads: duplicates.reduce((n, g) => n + (g.count - 1), 0),
        groups: duplicates,
      },
      { headers: { 'Cache-Control': 'private, max-age=45' } },
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 });
  }
}
