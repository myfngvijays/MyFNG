import {
  buildMinimalBookingTelecrmFields,
  buildTelecrmFieldSummaryNote,
} from '@/lib/telecrm/utmFields';
import { extractUtmFromUnknown } from '@/lib/utm';

const EXTERNAL_AUTOUPDATE_URL =
  'https://022os10kr2.execute-api.ap-south-1.amazonaws.com/enterprise/66f6bc6faf29b5a6f29c9bbf/autoupdatelead';
const EXTERNAL_AUTOUPDATE_BEARER =
  '398fc0c7-ee90-4992-b214-4063f9f7ad031727771960659:e9580bb4-cb6f-47ff-81fb-847e5a98a5a2';

const TELECRM_TIMEOUT_MS = 8_000;

async function postTelecrmPayload(fields: Record<string, string | number | boolean>) {
  const summary = buildTelecrmFieldSummaryNote(fields);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TELECRM_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(EXTERNAL_AUTOUPDATE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${EXTERNAL_AUTOUPDATE_BEARER}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fields,
        actions: summary ? [{ type: 'SYSTEM_NOTE', text: summary }] : [],
      }),
      signal: controller.signal,
    });
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error(`TeleCRM push timed out after ${TELECRM_TIMEOUT_MS}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
  const responseBody = await res.text().catch(() => '');

  if (!res.ok) {
    throw new Error(`External API failed: ${res.status} ${responseBody || ''}`.trim());
  }

  if (responseBody) {
    console.info('[booking-telecrm-sync] TeleCRM response:', responseBody);
  }
}

async function resolveServiceTypeLabel(
  supabaseAdmin: any,
  leadRow: Record<string, any>,
): Promise<string | null> {
  const raw = String(leadRow.service_type || '').trim();
  if (raw && raw !== 'CAR_SERVICE' && raw !== 'HOME_CAR_SERVICE' && raw !== 'RSA') {
    return raw;
  }
  const ids = Array.isArray(leadRow.service_type_ids)
    ? leadRow.service_type_ids.map((id: unknown) => String(id || '').trim()).filter(Boolean)
    : [];
  if (!ids.length || !supabaseAdmin) return raw || null;

  try {
    const { data } = await supabaseAdmin.from('service_types').select('name').in('id', ids);
    const names = (data || []).map((row: { name?: string }) => String(row.name || '').trim()).filter(Boolean);
    if (names.length) return names.join(', ');
  } catch (err) {
    console.warn('[booking-telecrm-sync] service type resolve failed:', err);
  }
  return raw || null;
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

  const serviceLabel = await resolveServiceTypeLabel(supabaseAdmin, leadRow);
  const enrichedLead = serviceLabel ? { ...leadRow, service_type: serviceLabel } : leadRow;

  const fields = buildMinimalBookingTelecrmFields(enrichedLead, phoneDigits, {
    leadTag: options?.leadTag,
    leadSource: options?.leadSource,
    createdFrom: options?.createdFrom,
  });
  const utmKeys = ['UTM Source', 'UTM Medium', 'UTM Campaign', 'UTM Term', 'UTM Content'];
  const hasUtm = utmKeys.some((key) => Boolean(fields[key]));

  if (!hasUtm) {
    console.warn('[booking-telecrm-sync] No UTM on lead push', {
      lead_number: leadRow.lead_number,
      meta: leadRow.meta,
      extracted: extractUtmFromUnknown(leadRow),
    });
  }

  await postTelecrmPayload(fields);
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
