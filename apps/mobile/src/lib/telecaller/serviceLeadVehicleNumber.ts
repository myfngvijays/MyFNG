/**
 * service_leads.vehicle_number is NOT NULL.
 * Soft CRM saves (Lost, Ringing, Follow-up) may omit RC — keep existing or PENDING.
 */
export function serviceLeadVehicleNumber(input: unknown, existing?: unknown): string {
  const next = String(input ?? '')
    .trim()
    .toUpperCase()
    .slice(0, 20);
  if (next) return next;
  const prev = String(existing ?? '')
    .trim()
    .toUpperCase()
    .slice(0, 20);
  if (prev) return prev;
  return 'PENDING';
}
