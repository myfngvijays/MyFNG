import { NextRequest, NextResponse } from 'next/server';
import {
  isNextResponse,
  requireCrmReportsContext,
} from '@/lib/telecaller/crmReportsAuth';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { parseReferredBy } from '@/lib/telecaller/crmLeadReference';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const LEAD_COLS =
  'id, lead_number, customer_name, customer_phone, status, city, coupon_meta, deleted_at';

function mapHit(row: any) {
  return {
    id: String(row.id),
    lead_number: String(row.lead_number || ''),
    customer_name: String(row.customer_name || ''),
    customer_phone: String(row.customer_phone || '')
      .replace(/\D/g, '')
      .slice(-10),
    status: String(row.status || ''),
    city: String(row.city || ''),
  };
}

/**
 * GET /api/telecaller/crm/lead-reference?lead_id=
 *   → referred_by + referred_to (who this lead sent)
 * GET /api/telecaller/crm/lead-reference?q=95946&exclude=
 *   → search existing leads by phone / name
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
      let query = db
        .from('service_leads')
        .select(LEAD_COLS)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })
        .limit(8);

      if (phone10.length >= 4) {
        query = query.or(
          `customer_phone.ilike.%${phone10}%,customer_phone.eq.${phone10},customer_phone.eq.91${phone10}`,
        );
      } else {
        query = query.ilike('customer_name', `%${q}%`);
      }
      if (exclude) query = query.neq('id', exclude);

      const { data, error } = await query;
      if (error) return NextResponse.json({ success: true, results: [] });
      return NextResponse.json({
        success: true,
        results: (data || []).map(mapHit),
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

    let referredTo: ReturnType<typeof mapHit>[] = [];
    const jsonTry = await db
      .from('service_leads')
      .select(LEAD_COLS)
      .contains('coupon_meta', { referred_by: { lead_id: leadId } })
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .limit(40);

    if (!jsonTry.error && Array.isArray(jsonTry.data)) {
      referredTo = jsonTry.data.map(mapHit);
    } else {
      const fallback = await db
        .from('service_leads')
        .select(LEAD_COLS)
        .not('coupon_meta', 'is', null)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })
        .limit(200);
      referredTo = (fallback.data || [])
        .filter((row: any) => parseReferredBy(row.coupon_meta)?.lead_id === leadId)
        .map(mapHit);
    }

    return NextResponse.json({
      success: true,
      referred_by: referredBy,
      referred_to: referredTo,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 });
  }
}
