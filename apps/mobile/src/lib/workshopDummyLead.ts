/** Dummy workshop test leads (advisor / pickup / mechanic). */
export function isDummyWorkshopLead(lead?: {
  lead_number?: string | null;
  created_from?: string | null;
  customer_name?: string | null;
} | null): boolean {
  const num = String(lead?.lead_number || '').toUpperCase();
  if (num.startsWith('L-DUM')) return true;
  if (lead?.created_from === 'DUMMY_SEED') return true;
  return /\bdummy\b/i.test(String(lead?.customer_name || ''));
}
