import {
  extractUtmFromUnknown,
  mergeUtmParams,
  normalizeUtmParams,
  type UtmParams,
  UTM_KEYS,
} from '@/lib/utm';

/** TeleCRM custom field labels (Fields Settings). */
const TELECRM_UTM_FIELD_LABELS: Record<(typeof UTM_KEYS)[number], string> = {
  utm_source: 'UTM Source',
  utm_medium: 'UTM Medium',
  utm_campaign: 'UTM Campaign',
  utm_term: 'UTM Term',
  utm_content: 'UTM Content',
};

export function extractUtmFromLeadRecord(row: Record<string, unknown> | null | undefined): UtmParams {
  return extractUtmFromUnknown(row || {});
}

/** Map utm_* params → TeleCRM field names; skips empty values. */
export function buildTelecrmUtmFields(raw: unknown): Record<string, string> {
  const utm = extractUtmFromUnknown(raw);
  const fields: Record<string, string> = {};

  UTM_KEYS.forEach((key) => {
    const value = utm[key];
    if (value) fields[TELECRM_UTM_FIELD_LABELS[key]] = value;
  });

  return fields;
}

/** One-line summary for TeleCRM system note (screenshot-style field list). */
export function buildTelecrmFieldSummaryNote(
  fields: Record<string, string | number | boolean>,
): string {
  return Object.entries(fields)
    .filter(([key]) => key !== 'Phone')
    .map(([key, value]) => `${key} = ${value}`)
    .join(' ');
}

export function buildUtmSystemNote(raw: unknown): string | null {
  const utm = normalizeUtmParams(raw);
  const parts = UTM_KEYS.filter((key) => utm[key]).map(
    (key) => `${TELECRM_UTM_FIELD_LABELS[key]}=${utm[key]}`,
  );
  return parts.length > 0 ? `UTM: ${parts.join(' | ')}` : null;
}

/** TeleCRM ignores empty/null fields — strip them before autoupdatelead POST. */
export function compactTelecrmFields(fields: Record<string, unknown>): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value === null || value === undefined || value === '') continue;
    out[key] = value as string | number | boolean;
  }
  return out;
}

/** Merge TeleCRM UTM fields into an autoupdatelead `fields` object. */
export function withTelecrmUtmFields<T extends Record<string, unknown>>(
  fields: T,
  raw: unknown,
): Record<string, string | number | boolean> {
  return compactTelecrmFields({
    ...fields,
    ...buildTelecrmUtmFields(raw),
  });
}

function cleanTelecrmText(value: unknown): string | null {
  const str = String(value ?? '').trim();
  return str.length > 0 ? str : null;
}

function cleanTelecrmAmount(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(String(value).replace(/[₹,\s]/g, ''));
  return Number.isFinite(n) ? n : null;
}

/** Map MyFNG lead status → TeleCRM status label (Fields Settings). */
function mapBookingStatusToTelecrm(status: unknown): string {
  const raw = String(status || 'NEW').trim().toUpperCase();
  if (!raw || raw === 'NEW') return 'Fresh';
  if (raw === 'VALIDATED' || raw === 'CONFIRMED') return 'Fresh';
  if (raw === 'LOST' || raw === 'CANCELLED' || raw === 'CANCELED') return 'Lost';
  // Prefer title-case so TeleCRM can match configured statuses
  return raw.charAt(0) + raw.slice(1).toLowerCase();
}

export function buildMinimalBookingTelecrmFields(
  leadRow: Record<string, unknown>,
  phoneDigits: string,
  options?: {
    leadTag?: string;
    leadSource?: string;
    createdFrom?: string;
  },
): Record<string, string | number | boolean> {
  const pickupAddress = cleanTelecrmText(
    leadRow.pickup_address || leadRow.address || leadRow.customer_address,
  );
  const vehicleModel = [leadRow.vehicle_make, leadRow.vehicle_model, leadRow.vehicle_variant]
    .map((v) => cleanTelecrmText(v))
    .filter(Boolean)
    .join(' ')
    .trim() || null;
  const amount =
    cleanTelecrmAmount(leadRow.estimated_amount) ??
    cleanTelecrmAmount(leadRow.actual_amount) ??
    cleanTelecrmAmount(leadRow.customer_quoted_amount);
  const slot = cleanTelecrmText(leadRow.preferred_slot_start || leadRow.preferred_date);
  const timeSlot = cleanTelecrmText(leadRow.preferred_time_slot);

  return compactTelecrmFields({
    Phone: `+91${phoneDigits}`,
    Name: cleanTelecrmText(leadRow.customer_name),
    LeadNumber: cleanTelecrmText(leadRow.lead_number),
    // TeleCRM status field — "NEW" is not configured (shows "No matched status for NEW")
    Status: mapBookingStatusToTelecrm(leadRow.status),
    LeadStatus: mapBookingStatusToTelecrm(leadRow.status),
    LEADTAG: cleanTelecrmText(options?.leadTag) || 'APP',
    LeadSource: cleanTelecrmText(options?.leadSource || leadRow.lead_source) || 'App Booking',
    CreatedFrom: cleanTelecrmText(options?.createdFrom || leadRow.created_from) || 'MOBILE_APP',
    City: cleanTelecrmText(leadRow.city),
    State: cleanTelecrmText(leadRow.state),
    Pincode: cleanTelecrmText(leadRow.pincode),
    ServiceType: cleanTelecrmText(leadRow.service_type),
    VehicleNumber: cleanTelecrmText(leadRow.vehicle_number),
    VehicleModel: vehicleModel,
    carModel: vehicleModel,
    EstimatedAmount: amount,
    PickupAddress: pickupAddress,
    PreferredSlot: slot,
    PreferredTimeSlot: timeSlot,
    Disposition: cleanTelecrmText(options?.leadSource || leadRow.lead_source) || 'App Booking',
    ...buildTelecrmUtmFields(leadRow),
  });
}

export function buildMinimalMisaTelecrmFields(
  booking: Record<string, unknown>,
  phoneDigits: string,
): Record<string, string | number | boolean> {
  const address = String(booking.address || '').trim();

  return compactTelecrmFields({
    Phone: `+91${phoneDigits}`,
    Name: String(booking.customer_name || '').trim() || null,
    Status: booking.status || 'NEW',
    PickupAddress: address || null,
    ...buildTelecrmUtmFields(booking.tracking_utm || booking),
  });
}

export function buildTelecrmFieldsWithUtm(
  fields: Record<string, unknown>,
  leadRow: Record<string, unknown> | null | undefined,
): Record<string, string | number | boolean> {
  const utm = extractUtmFromLeadRecord(leadRow);
  return withTelecrmUtmFields(fields, utm);
}

export function buildTelecrmSystemNote(baseNote: string, leadRow: Record<string, unknown> | null | undefined): string {
  const utmNote = buildUtmSystemNote(extractUtmFromLeadRecord(leadRow));
  return utmNote ? `${baseNote} | ${utmNote}` : baseNote;
}

export function mergeLeadMetaWithUtm(
  existingMeta: unknown,
  ...utmSources: unknown[]
): Record<string, any> {
  const utm = mergeUtmParams(extractUtmFromUnknown(existingMeta), ...utmSources);
  const meta: Record<string, any> =
    existingMeta && typeof existingMeta === 'object'
      ? { ...(existingMeta as Record<string, any>) }
      : {};

  UTM_KEYS.forEach((key) => {
    if (utm[key]) meta[key] = utm[key]!;
  });

  if (Object.keys(utm).length > 0) {
    meta.tracking = { ...utm };
  }

  return meta;
}
