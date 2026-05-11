/**
 * Shared helper to push a telecrm_api row to TeleCRM's autoupdatelead endpoint.
 *
 * Mirrors the booking-flow payload (apps/web/src/lib/chatbot_v2/booking.ts):
 *   - Only sends fields that have a real value (no nulls/empty strings).
 *   - Always includes Phone (mandatory), LEADTAG, LeadSource, LeadStatus,
 *     CreatedFrom, CreatedAt + a SYSTEM_NOTE action.
 *   - Maps only the columns that exist on the public.telecrm_api table.
 *
 * Used by:
 *   - apps/web/src/app/api/sarv/webhook/route.ts (after upserting a row)
 *   - apps/web/src/app/api/telecaller/rsa-complaints/route.ts (after registering complaint)
 *   - apps/web/src/app/api/telecaller/rsa-complaints/[id]/route.ts (after updating complaint)
 *   - apps/web/src/app/api/cron/telecrm-push/route.ts (12hr backfill cron)
 */

const TELECRM_AUTOUPDATE_URL =
  'https://022os10kr2.execute-api.ap-south-1.amazonaws.com/enterprise/66f6bc6faf29b5a6f29c9bbf/autoupdatelead';
const TELECRM_BEARER =
  '398fc0c7-ee90-4992-b214-4063f9f7ad031727771960659:e9580bb4-cb6f-47ff-81fb-847e5a98a5a2';

export type TelecrmRow = {
  id: string;
  name: string | null;
  mobile: string | null;
  city: string | null;
  pincode: string | null;
  state: string | null;
  service_type: string | null;
  vehicle_number: string | null;
  vehicle_model: string | null;
  customer_quoted_amount: number | string | null;
  location_link: string | null;
  recording_url: string | null;
  disposition: string | null;
  disposition_category: string | null;
  disposition_note: string | null;
};

export type TelecrmPushResult = {
  success: boolean;
  status?: number;
  response?: any;
  error?: string;
  skipped?: boolean;
  reason?: string;
};

const TELECRM_COLUMNS =
  'id, name, mobile, city, pincode, state, service_type, vehicle_number, vehicle_model, customer_quoted_amount, location_link, recording_url, disposition, disposition_category, disposition_note';

function digits10(input: unknown): string {
  const raw = String(input ?? '');
  const d = raw.replace(/\D/g, '');
  return d.length <= 10 ? d : d.slice(-10);
}

function clean(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  return str.length > 0 ? str : null;
}

function cleanNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(String(value).replace(/[₹,\s]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function buildPayload(row: TelecrmRow) {
  const phone10 = digits10(row.mobile);
  if (!phone10) return null;

  const fields: Record<string, any> = {
    Name: clean(row.name) || 'RSA Call Lead',
    Phone: `+91${phone10}`,
    LEADTAG: 'RSA_CALL',
    LeadSource: 'Sarv Call',
    LeadStatus: 'New',
    CreatedFrom: 'SARV_CALL',
    CreatedAt: new Date().toISOString(),
  };

  const optional: Record<string, unknown> = {
    City: clean(row.city),
    State: clean(row.state),
    Pincode: clean(row.pincode),
    ServiceType: clean(row.service_type),
    VehicleNumber: clean(row.vehicle_number),
    VehicleModel: clean(row.vehicle_model),
    carModel: clean(row.vehicle_model),
    EstimatedAmount: cleanNumber(row.customer_quoted_amount),
    LocationLink: clean(row.location_link),
    RecordingUrl: clean(row.recording_url),
    Disposition: clean(row.disposition),
    DispositionCategory: clean(row.disposition_category),
    DispositionNote: clean(row.disposition_note),
  };

  for (const [key, value] of Object.entries(optional)) {
    if (value !== null && value !== undefined && value !== '') {
      fields[key] = value;
    }
  }

  return {
    fields,
    actions: [
      {
        type: 'SYSTEM_NOTE',
        text: `Lead Source: RSA_CALL${clean(row.disposition) ? ` | Disposition: ${row.disposition}` : ''}`,
      },
    ],
  };
}

/**
 * Push a single telecrm_api row to TeleCRM and persist the response back to the row.
 */
export async function pushTelecrmRow(
  db: any,
  row: TelecrmRow,
  context: string = 'telecrm-push'
): Promise<TelecrmPushResult> {
  const payload = buildPayload(row);
  if (!payload) {
    return { success: false, skipped: true, reason: 'Missing/invalid mobile number' };
  }

  try {
    const res = await fetch(TELECRM_AUTOUPDATE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TELECRM_BEARER}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseText = await res.text().catch(() => '');
    let parsedResponse: any;
    try {
      parsedResponse = responseText ? JSON.parse(responseText) : { status: res.status };
    } catch {
      parsedResponse = { raw: responseText, status: res.status, ok: res.ok };
    }

    const now = new Date().toISOString();
    await db
      .from('telecrm_api')
      .update({
        api_response: parsedResponse,
        api_datetime: now,
        updated_at: now,
      })
      .eq('id', row.id);

    if (!res.ok) {
      console.error(`[${context}] TeleCRM responded ${res.status}:`, responseText);
      return { success: false, status: res.status, response: parsedResponse, error: `TeleCRM ${res.status}` };
    }

    return { success: true, status: res.status, response: parsedResponse };
  } catch (err: any) {
    console.error(`[${context}] TeleCRM push threw:`, err?.message || err);
    return { success: false, error: err?.message || 'Unknown error' };
  }
}

/**
 * Look up the latest telecrm_api row for a mobile number and push it.
 * Used for "fire-and-forget" sync from webhooks/handlers without blocking the response.
 */
export async function syncTelecrmRowByMobile(
  db: any,
  mobile: string | null | undefined,
  context: string = 'telecrm-push'
): Promise<TelecrmPushResult> {
  const phone10 = digits10(mobile);
  if (!phone10) {
    return { success: false, skipped: true, reason: 'Missing mobile' };
  }

  const { data: row, error } = await db
    .from('telecrm_api')
    .select(TELECRM_COLUMNS)
    .eq('mobile', phone10)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(`[${context}] telecrm row lookup failed:`, error.message);
    return { success: false, error: error.message };
  }

  if (!row) {
    return { success: false, skipped: true, reason: 'No telecrm_api row for mobile' };
  }

  return pushTelecrmRow(db, row as TelecrmRow, context);
}

/**
 * Fire-and-forget variant: schedules the push without awaiting it so callers
 * (webhooks/handlers) can return their response immediately.
 */
export function syncTelecrmRowByMobileSafe(
  db: any,
  mobile: string | null | undefined,
  context: string = 'telecrm-push'
): void {
  Promise.resolve().then(async () => {
    try {
      const result = await syncTelecrmRowByMobile(db, mobile, context);
      if (!result.success && !result.skipped) {
        console.warn(`[${context}] background push failed:`, result.error);
      }
    } catch (e: any) {
      console.error(`[${context}] background push threw:`, e?.message || e);
    }
  });
}

export const TELECRM_API_SELECT_COLUMNS = TELECRM_COLUMNS;
