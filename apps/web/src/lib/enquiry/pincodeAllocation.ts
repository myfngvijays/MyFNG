import type { AllocationRow } from '@/lib/enquiry/assignment';

export type PincodeRoutingMode = 'all' | 'mapped' | 'none';

/** Normalize Indian pincode to 6 digits when possible. */
export function normalizePincode(raw: unknown): string | null {
  const digits = String(raw || '').replace(/\D/g, '').trim();
  if (!digits) return null;
  if (digits.length >= 6) return digits.slice(0, 6);
  return digits.length >= 4 ? digits : null;
}

/** null = all pincodes; [] = none; [...] = only those pincodes */
export function normalizeAllowedPincodes(raw: unknown): string[] | null {
  if (raw == null) return null;
  if (!Array.isArray(raw)) return null;
  if (raw.length === 0) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const pin = normalizePincode(item);
    if (!pin || seen.has(pin)) continue;
    seen.add(pin);
    out.push(pin);
  }
  return out;
}

export function formatAllowedPincodesInput(allowed: string[] | null | undefined): string {
  if (allowed == null) return '';
  return allowed.join(', ');
}

export function parsePincodesInput(raw: string): string[] | null {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return null;
  return normalizeAllowedPincodes(trimmed.split(/[\s,;]+/));
}

export function normalizePincodeMode(
  raw: unknown,
  allowedPincodes: string[] | null = null,
): PincodeRoutingMode {
  const mode = String(raw || '')
    .trim()
    .toLowerCase();
  if (mode === 'all' || mode === 'mapped' || mode === 'none') return mode;

  // Backward compatibility for rows saved before pincode_mode existed.
  if (allowedPincodes == null) return 'all';
  if (allowedPincodes.length === 0) return 'none';
  return 'mapped';
}

export function pincodePayloadFromMode(
  mode: PincodeRoutingMode,
  pincodes: string[] | null | undefined,
): { pincode_mode: PincodeRoutingMode; allowed_pincodes: string[] | null } {
  if (mode === 'all') {
    return { pincode_mode: 'all', allowed_pincodes: null };
  }
  if (mode === 'none') {
    return { pincode_mode: 'none', allowed_pincodes: [] };
  }
  return {
    pincode_mode: 'mapped',
    allowed_pincodes: normalizeAllowedPincodes(pincodes || []) || [],
  };
}

/**
 * Pincode routing pool:
 * - If lead has pincode and telecallers have that pincode mapped → only those telecallers.
 * - Else → telecallers with no pincode restriction (null allowlist).
 * - Telecallers with a different pincode list are excluded when lead pincode is known.
 */
export function filterAllocationsForLeadPincode(
  rows: AllocationRow[],
  pincode: string | null | undefined,
): AllocationRow[] {
  const normalized = normalizePincode(pincode);
  if (!normalized) return rows;

  const specific = rows.filter((row) => {
    const allowed = row.allowed_pincodes;
    const mode = normalizePincodeMode(row.pincode_mode, allowed ?? null);
    return mode === 'mapped' && Array.isArray(allowed) && allowed.length > 0 && allowed.includes(normalized);
  });
  if (specific.length > 0) return specific;

  return rows.filter((row) => {
    const mode = normalizePincodeMode(row.pincode_mode, row.allowed_pincodes ?? null);
    return mode === 'all' || row.allowed_pincodes == null;
  });
}
