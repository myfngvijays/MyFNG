const PLACEHOLDER_PLATES = new Set([
  '',
  'NA',
  'N/A',
  'PENDING',
  'NONE',
  'NULL',
  'UNDEFINED',
  'NOT PROVIDED',
  '—',
]);

/** UI / forms: never show NA / PENDING as a registration number. */
export function sanitizeVehicleNumberInput(v: unknown): string {
  const s = String(v ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 20);
  if (!s || PLACEHOLDER_PLATES.has(s)) return '';
  return s;
}

export function isPlaceholderVehicleNumber(v: unknown): boolean {
  return !sanitizeVehicleNumberInput(v);
}

/**
 * service_leads.vehicle_number is NOT NULL.
 * Soft CRM saves (Lost, Ringing, Follow-up) may omit RC — keep existing or PENDING.
 */
export function serviceLeadVehicleNumber(input: unknown, existing?: unknown): string {
  const next = sanitizeVehicleNumberInput(input);
  if (next) return next;
  const prev = sanitizeVehicleNumberInput(existing);
  if (prev) return prev;
  return 'PENDING';
}
