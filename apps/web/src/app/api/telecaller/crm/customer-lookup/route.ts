import { NextRequest, NextResponse } from 'next/server';
import {
  isNextResponse,
  requireCrmReportsContext,
} from '@/lib/telecaller/crmReportsAuth';
import { lookupKnownCustomerFill } from '@/lib/whatsappAgents/inboundServiceLead';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export const dynamic = 'force-dynamic';

/**
 * GET /api/telecaller/crm/customer-lookup?phone=9594657469
 * Autofill known customer / past lead details for telecaller CRM forms.
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireCrmReportsContext(request);
    if (isNextResponse(ctx)) return ctx;

    const phone10 = String(request.nextUrl.searchParams.get('phone') || '')
      .replace(/\D/g, '')
      .slice(-10);
    if (phone10.length !== 10) {
      return NextResponse.json({ error: 'Valid 10-digit phone required' }, { status: 400 });
    }

    const { supabaseAdmin } = getSupabaseAdmin();
    const db = supabaseAdmin || ctx.db;
    const fill = await lookupKnownCustomerFill(db, phone10);

    let city_id: string | null = null;
    if (fill.city) {
      const { data: cityRow } = await db
        .from('cities')
        .select('id, name')
        .ilike('name', String(fill.city).trim())
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      if (cityRow?.id) city_id = String(cityRow.id);
    }

    if (!city_id && fill.pincode && String(fill.pincode).replace(/\D/g, '').length === 6) {
      const pin = String(fill.pincode).replace(/\D/g, '').slice(0, 6);
      const { data: cities } = await db
        .from('cities')
        .select('id, name, city_pincodes')
        .eq('is_active', true)
        .limit(500);
      const hit = (cities || []).find((c: any) => String(c.city_pincodes || '').includes(pin));
      if (hit?.id) {
        city_id = String(hit.id);
        if (!fill.city) fill.city = String(hit.name || '');
      }
    }

    const hasAny = Boolean(
      fill.customer_name ||
        fill.customer_email ||
        fill.vehicle_number ||
        fill.vehicle_make ||
        fill.city ||
        fill.customer_address,
    );

    return NextResponse.json({
      ok: true,
      found: hasAny,
      fill: {
        ...fill,
        city_id,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Lookup failed' }, { status: 500 });
  }
}
