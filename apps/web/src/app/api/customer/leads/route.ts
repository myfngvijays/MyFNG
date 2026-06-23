/**
 * GET /api/customer/leads
 * Returns service leads for the current customer (session).
 */

import { NextResponse } from 'next/server';
import { getCustomerFromSession } from '@/lib/customer-session';
import {
  buildCustomerLeadOrFilter,
  filterLeadsForCustomer,
  normalizeCustomerPhone,
} from '@/lib/customer-service-leads';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { customer } = await getCustomerFromSession();
  if (!customer) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  const normalizedPhone = normalizeCustomerPhone(customer.phone);
  if (!normalizedPhone) {
    return NextResponse.json({ error: 'Invalid customer phone' }, { status: 400 });
  }

  const { data: leads, error } = await supabaseAdmin
    .from('service_leads')
    .select('id, lead_number, status, vehicle_number, vehicle_make, vehicle_model, fuel_type:vehicle_fuel_type, service_type, service_type_ids, subservice_ids, description, estimated_amount, created_at, customer_phone, address, city, state, pincode, meta')
    .or(buildCustomerLeadOrFilter({ id: customer.id, phone: normalizedPhone }))
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 });
  }

  const rows = filterLeadsForCustomer(leads, { id: customer.id, phone: normalizedPhone });
  const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const parseIdList = (input: unknown): string[] => {
    if (!input) return [];
    if (Array.isArray(input)) return input.map((v) => String(v || '').trim()).filter(Boolean);
    const raw = String(input || '').trim();
    if (!raw) return [];
    try {
      if (raw.startsWith('[') && raw.endsWith(']')) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.map((v) => String(v || '').trim()).filter(Boolean);
      }
    } catch {
      // ignore and fallback to simple split
    }
    return raw.split(',').map((v) => v.trim()).filter(Boolean);
  };

  const serviceTypeIds = Array.from(new Set(rows.flatMap((r: any) => {
    const ids = parseIdList(r.service_type_ids).filter((v) => uuidLike.test(v));
    const legacy = String(r.service_type || '').trim();
    if (uuidLike.test(legacy)) ids.push(legacy);
    return ids;
  })));

  const subserviceIds = Array.from(new Set(rows.flatMap((r: any) =>
    parseIdList(r.subservice_ids).filter((v) => uuidLike.test(v))
  )));

  const serviceTypeNameById: Record<string, string> = {};
  if (serviceTypeIds.length > 0) {
    const { data: serviceTypes } = await supabaseAdmin
      .from('service_types')
      .select('id, name')
      .in('id', serviceTypeIds);
    for (const s of serviceTypes || []) {
      serviceTypeNameById[String((s as any).id)] = String((s as any).name || '');
    }
  }

  const addonNameById: Record<string, string> = {};
  if (subserviceIds.length > 0) {
    const { data: addons } = await supabaseAdmin
      .from('service_addons')
      .select('id, name')
      .in('id', subserviceIds);
    for (const a of addons || []) {
      addonNameById[String((a as any).id)] = String((a as any).name || '');
    }
  }

  const enriched = rows.map((r: any) => {
    const rawServiceType = String(r.service_type || '').trim();
    const serviceNames = parseIdList(r.service_type_ids)
      .map((id) => serviceTypeNameById[id])
      .filter(Boolean);
    const addonNames = parseIdList(r.subservice_ids)
      .map((id) => addonNameById[id])
      .filter(Boolean);

    const resolvedServiceType =
      serviceNames.join(', ') ||
      serviceTypeNameById[rawServiceType] ||
      (rawServiceType && !uuidLike.test(rawServiceType) && rawServiceType.toUpperCase() !== 'CAR_SERVICE' ? rawServiceType : '') ||
      addonNames.join(', ') ||
      String(r.description || '').trim() ||
      'Car Service';

    return {
      ...r,
      service_display: resolvedServiceType,
    };
  });

  return NextResponse.json({ leads: enriched });
}
