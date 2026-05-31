import { NextResponse } from 'next/server';
import { requireCustomer } from '@/lib/customer-api';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const ctx = await requireCustomer();
  if ('response' in ctx) return ctx.response;
  const { customer, supabaseAdmin } = ctx;
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const vehicle = searchParams.get('vehicle');
  const q = searchParams.get('q');

  let query = supabaseAdmin
    .from('service_leads')
    .select('id, lead_number, status, service_type, description, service_type_ids, subservice_ids, vehicle_number, vehicle_make, vehicle_model, fuel_type:vehicle_fuel_type, estimated_amount, actual_amount, invoice_amount, created_at, completed_at, invoice_id, workshop_id, city, address, customer_address, pickup_address, preferred_date, preferred_time, workshops(name, workshop_name)')
    .eq('customer_phone', customer.phone)
    .order('created_at', { ascending: false })
    .limit(200);

  if (status) query = query.eq('status', status);
  if (vehicle) query = query.eq('vehicle_number', vehicle);
  if (q) query = query.ilike('lead_number', `%${q}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: 'Failed to fetch order history' }, { status: 500 });

  const rows = data || [];
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

  const invoiceIds = Array.from(new Set(
    rows.map((r: any) => String(r.invoice_id || '').trim()).filter((v: string) => uuidLike.test(v))
  ));
  const invoiceAmountById: Record<string, number> = {};
  if (invoiceIds.length > 0) {
    const { data: invoices } = await supabaseAdmin
      .from('invoices')
      .select('id, final_amount')
      .in('id', invoiceIds);
    for (const inv of invoices || []) {
      invoiceAmountById[String((inv as any).id)] = Number((inv as any).final_amount || 0);
    }
  }

  const leadIds = Array.from(new Set(rows.map((r: any) => String(r.id || '').trim()).filter(Boolean)));
  const latestInvoiceAmountByLeadId: Record<string, number> = {};
  if (leadIds.length > 0) {
    const { data: invoicesByLead } = await supabaseAdmin
      .from('invoices')
      .select('lead_id, final_amount, created_at')
      .in('lead_id', leadIds)
      .order('created_at', { ascending: false });

    for (const inv of invoicesByLead || []) {
      const leadId = String((inv as any).lead_id || '').trim();
      if (!leadId) continue;
      if (latestInvoiceAmountByLeadId[leadId] === undefined) {
        latestInvoiceAmountByLeadId[leadId] = Number((inv as any).final_amount || 0);
      }
    }
  }

  const orders = rows.map((r: any) => {
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
      (!uuidLike.test(rawServiceType) ? rawServiceType : '') ||
      addonNames.join(', ') ||
      String(r.description || '').trim() ||
      'Service';

    const actualAmount = Number(r.actual_amount || 0);
    const estimatedAmount = Number(r.estimated_amount || 0);
    const invoiceAmount = Number(r.invoice_amount || 0);
    const finalInvoiceAmount = invoiceAmountById[String(r.invoice_id || '')] || 0;
    const latestInvoiceAmount = latestInvoiceAmountByLeadId[String(r.id || '')] || 0;
    const displayAmount =
      latestInvoiceAmount > 0
        ? latestInvoiceAmount
        : finalInvoiceAmount > 0
          ? finalInvoiceAmount
        : invoiceAmount > 0
          ? invoiceAmount
          : actualAmount > 0
            ? actualAmount
            : estimatedAmount > 0
              ? estimatedAmount
              : null;

    const workshopName = r.workshops?.workshop_name || r.workshops?.name || '';

    return {
      ...r,
      service_display: resolvedServiceType,
      amount_display: displayAmount,
      workshop_name: workshopName,
    };
  });

  return NextResponse.json({ orders });
}

