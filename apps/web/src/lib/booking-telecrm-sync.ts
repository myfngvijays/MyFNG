const EXTERNAL_AUTOUPDATE_URL =
  'https://022os10kr2.execute-api.ap-south-1.amazonaws.com/enterprise/66f6bc6faf29b5a6f29c9bbf/autoupdatelead';
const EXTERNAL_AUTOUPDATE_BEARER =
  '398fc0c7-ee90-4992-b214-4063f9f7ad031727771960659:e9580bb4-cb6f-47ff-81fb-847e5a98a5a2';

async function resolveServiceNames(supabaseAdmin: any, serviceTypeIds: string[]): Promise<string[]> {
  if (!serviceTypeIds.length) return [];
  try {
    const { data } = await supabaseAdmin
      .from('service_types')
      .select('id, name')
      .in('id', serviceTypeIds);
    if (!data || !data.length) return [];
    const nameMap = new Map((data as any[]).map((r: any) => [r.id, r.name]));
    return serviceTypeIds.map((id) => nameMap.get(id) || id);
  } catch {
    return serviceTypeIds;
  }
}

export async function pushServiceLeadToTeleCRM(
  leadRow: Record<string, any>,
  supabaseAdmin: any,
  options?: {
    leadTag?: string;
    leadSource?: string;
    createdFrom?: string;
    systemNote?: string;
  },
) {
  const phoneDigits = String(leadRow.customer_phone || '').replace(/\D/g, '').slice(-10);
  if (!phoneDigits) return;

  const serviceTypeIds = Array.isArray(leadRow.service_type_ids) ? leadRow.service_type_ids : [];
  const serviceNames = await resolveServiceNames(supabaseAdmin, serviceTypeIds);

  const createdFrom = options?.createdFrom || leadRow.created_from || 'MOBILE_APP';
  const leadTag = options?.leadTag || (String(createdFrom).includes('WEB') ? 'WEBSITE' : 'APP');
  const leadSource = options?.leadSource || leadRow.lead_source || 'App Booking';
  const systemNote = options?.systemNote || `Lead Source: ${leadSource}`;

  const payload = {
    fields: {
      Name: String(leadRow.customer_name || '').trim() || 'App Lead',
      Phone: `+91${phoneDigits}`,
      LEADTAG: leadTag,
      LeadSource: leadSource,
      LeadStatus: leadRow.status || 'NEW',
      LeadNumber: leadRow.lead_number || null,
      Status: leadRow.status || 'NEW',
      City: leadRow.city || null,
      ServiceType: serviceNames.length > 0 ? serviceNames.join(', ') : null,
      Services: serviceNames.length > 0 ? serviceNames.join(', ') : null,
      Vehicle: [leadRow.vehicle_make, leadRow.vehicle_model, leadRow.vehicle_variant].filter(Boolean).join(' ') || null,
      VehicleNumber: leadRow.vehicle_number || null,
      VehicleNo: leadRow.vehicle_number || null,
      VehicleModel: [leadRow.vehicle_make, leadRow.vehicle_model].filter(Boolean).join(' ') || null,
      EstimatedAmount: leadRow.estimated_amount != null ? String(leadRow.estimated_amount) : null,
      PickupRequired: typeof leadRow.pickup_required === 'boolean' ? String(leadRow.pickup_required) : null,
      PickupAddress: leadRow.pickup_address || null,
      PreferredSlot: leadRow.preferred_slot_start || null,
      PaymentMode: leadRow.payment_mode || null,
      PaymentStatus: leadRow.payment_status || null,
      CouponCode: leadRow.coupon_code || null,
      DiscountAmount: leadRow.discount_amount != null ? String(leadRow.discount_amount) : null,
      CreatedFrom: createdFrom,
      CreatedAt: new Date().toISOString(),
    },
    actions: [{ type: 'SYSTEM_NOTE', text: systemNote }],
  };

  const res = await fetch(EXTERNAL_AUTOUPDATE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${EXTERNAL_AUTOUPDATE_BEARER}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const responseBody = await res.text().catch(() => '');

  if (!res.ok) {
    throw new Error(`External API failed: ${res.status} ${responseBody || ''}`.trim());
  }

  if (responseBody) {
    console.info('[booking-telecrm-sync] TeleCRM response:', responseBody);
  }
}

export async function saveBookedVehicleToProfile(
  supabaseAdmin: any,
  lead: Record<string, any>,
  customerPhone: string,
) {
  try {
    const vehicleNumber = String(lead?.vehicle_number || '').trim().toUpperCase();
    const make = String(lead?.vehicle_make || '').trim();
    const model = String(lead?.vehicle_model || '').trim();
    if (!make && !model) return;

    const phoneDigits = String(customerPhone || '').replace(/\D/g, '').slice(-10);
    if (!phoneDigits) return;

    const { data: customer } = await supabaseAdmin
      .from('customers')
      .select('id')
      .eq('phone', phoneDigits)
      .maybeSingle();
    if (!customer?.id) return;

    const plate = vehicleNumber && vehicleNumber !== 'NA' ? vehicleNumber : `${make}-${model}`.toUpperCase();

    await supabaseAdmin.from('customer_vehicles').upsert(
      {
        customer_id: customer.id,
        vehicle_number: plate,
        make: make || null,
        model: model || null,
        variant: lead?.vehicle_variant || null,
        fuel_type: lead?.fuel_type || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'customer_id,vehicle_number' },
    );
  } catch (err) {
    console.error('[booking-telecrm-sync] saveBookedVehicleToProfile failed:', err);
  }
}
