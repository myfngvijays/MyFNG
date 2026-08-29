import { NextRequest, NextResponse } from 'next/server';
import {
  isNextResponse,
  requireCrmReportsContext,
} from '@/lib/telecaller/crmReportsAuth';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { parseReferredBy } from '@/lib/telecaller/crmLeadReference';
import { findLeadsReferredByPerson } from '@/lib/crm-manual-references';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const LEAD_COLS =
  'id, lead_number, customer_name, customer_phone, status, city, coupon_meta, deleted_at';

function last10(phone: string | null | undefined) {
  return String(phone || '')
    .replace(/\D/g, '')
    .slice(-10);
}

function sanitizeIlike(s: string) {
  return s.replace(/[%_,()]/g, ' ').trim().slice(0, 80);
}

function customerDisplayName(fullName: string | null | undefined, phone: string) {
  const name = String(fullName || '').trim();
  if (name) return name;
  const last4 = phone.slice(-4);
  return last4 ? `User ${last4}` : 'App customer';
}

function mapLeadHit(row: any, extra?: { customer_id?: string }) {
  return {
    id: String(row.id),
    lead_id: String(row.id),
    customer_id: extra?.customer_id || undefined,
    lead_number: String(row.lead_number || ''),
    customer_name: String(row.customer_name || ''),
    customer_phone: last10(row.customer_phone),
    status: String(row.status || ''),
    city: String(row.city || ''),
    source: 'lead' as const,
  };
}

function mapCustomerHit(row: any) {
  const phone = last10(row.phone);
  return {
    id: `customer:${row.id}`,
    lead_id: '',
    customer_id: String(row.id),
    lead_number: 'App customer',
    customer_name: customerDisplayName(row.full_name, phone),
    customer_phone: phone,
    status: '',
    city: '',
    source: 'customer' as const,
  };
}

async function attachCustomerIds(db: any, hits: ReturnType<typeof mapLeadHit>[]) {
  const phones = [...new Set(hits.map((h) => h.customer_phone).filter((p) => p.length === 10))];
  if (!phones.length) return hits;
  const orFilter = phones.map((p) => `phone.ilike.%${p}%`).join(',');
  const { data } = await db.from('customers').select('id, phone, full_name').or(orFilter).limit(40);
  const byPhone = new Map<string, { id: string; full_name: string | null }>();
  for (const c of data || []) {
    const d = last10(c.phone);
    if (d && !byPhone.has(d)) byPhone.set(d, { id: String(c.id), full_name: c.full_name || null });
  }
  return hits.map((h) => {
    const c = byPhone.get(h.customer_phone);
    if (!c) return h;
    return {
      ...h,
      customer_id: h.customer_id || c.id,
      customer_name: h.customer_name || customerDisplayName(c.full_name, h.customer_phone),
    };
  });
}

/**
 * GET /api/telecaller/crm/lead-reference?lead_id=
 *   → referred_by + referred_to (who this lead sent)
 * GET /api/telecaller/crm/lead-reference?q=95946&exclude=
 *   → search CRM leads + app customers by phone / name
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireCrmReportsContext(request);
    if (isNextResponse(ctx)) return ctx;

    const { supabaseAdmin } = getSupabaseAdmin();
    const db = supabaseAdmin || ctx.db;
    const q = String(request.nextUrl.searchParams.get('q') || '').trim();
    const leadId = String(request.nextUrl.searchParams.get('lead_id') || '').trim();
    const exclude = String(request.nextUrl.searchParams.get('exclude') || leadId || '').trim();

    if (q) {
      const digits = q.replace(/\D/g, '');
      const phone10 = digits.slice(-10);
      const nameTerm = sanitizeIlike(q);

      let leadQuery = db
        .from('service_leads')
        .select(LEAD_COLS)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })
        .limit(8);

      if (phone10.length >= 4) {
        leadQuery = leadQuery.or(
          `customer_phone.ilike.%${phone10}%,customer_phone.eq.${phone10},customer_phone.eq.91${phone10}`,
        );
      } else if (nameTerm.length >= 2) {
        leadQuery = leadQuery.ilike('customer_name', `%${nameTerm}%`);
      } else {
        return NextResponse.json({ success: true, results: [] });
      }
      if (exclude) leadQuery = leadQuery.neq('id', exclude);

      const leadRes = await leadQuery;
      let leadHits = (leadRes.error ? [] : leadRes.data || []).map((row: any) => mapLeadHit(row));
      leadHits = await attachCustomerIds(db, leadHits);

      const seenPhones = new Set(leadHits.map((h) => h.customer_phone).filter(Boolean));
      const customerHits: ReturnType<typeof mapCustomerHit>[] = [];

      let custQuery = db.from('customers').select('id, phone, full_name').limit(8);
      if (phone10.length >= 4) {
        custQuery = custQuery.or(
          `phone.ilike.%${phone10}%,phone.eq.${phone10},phone.eq.91${phone10}`,
        );
      } else if (nameTerm.length >= 2) {
        custQuery = custQuery.ilike('full_name', `%${nameTerm}%`);
      }
      const custRes = await custQuery;
      for (const row of custRes.error ? [] : custRes.data || []) {
        const hit = mapCustomerHit(row);
        if (!hit.customer_phone || seenPhones.has(hit.customer_phone)) continue;
        seenPhones.add(hit.customer_phone);
        customerHits.push(hit);
      }

      return NextResponse.json({
        success: true,
        results: [...leadHits, ...customerHits].slice(0, 12),
      });
    }

    if (!leadId) {
      return NextResponse.json({ error: 'lead_id or q required' }, { status: 400 });
    }

    const { data: lead } = await db
      .from('service_leads')
      .select(LEAD_COLS)
      .eq('id', leadId)
      .maybeSingle();

    const referredBy = parseReferredBy(lead?.coupon_meta);
    const phone = last10(lead?.customer_phone);

    let customerId = '';
    if (phone.length === 10) {
      const { data: cust } = await db
        .from('customers')
        .select('id')
        .or(`phone.ilike.%${phone}%,phone.eq.${phone},phone.eq.91${phone}`)
        .limit(1)
        .maybeSingle();
      customerId = cust?.id ? String(cust.id) : '';
    }

    const referredRows = await findLeadsReferredByPerson(db, {
      phone,
      customerId,
      leadIds: [leadId],
      excludeLeadIds: [leadId],
      limit: 40,
    });

    return NextResponse.json({
      success: true,
      referred_by: referredBy,
      referred_to: referredRows.map((row: any) => mapLeadHit(row)),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 });
  }
}
