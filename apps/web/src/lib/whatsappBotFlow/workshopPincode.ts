export type WorkshopPinRow = {
  id?: string;
  name?: string | null;
  workshop_name?: string | null;
  city?: string | null;
  pincode?: string | null;
  service_pincode?: string | null;
  mapping_pincodes?: unknown;
  is_verified?: boolean | null;
  [key: string]: unknown;
};

export function normalizePincodeList(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((item) => String(item || '').trim()).filter((p) => /^\d{6}$/.test(p));
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[')) {
      try {
        return normalizePincodeList(JSON.parse(trimmed));
      } catch {
        // fall through
      }
    }
    return trimmed
      .split(/[|,;\s]+/)
      .map((p) => p.trim())
      .filter((p) => /^\d{6}$/.test(p));
  }
  return [];
}

export function workshopCoversPincode(workshop: WorkshopPinRow, pincode: string): boolean {
  const target = String(pincode || '').trim();
  if (!/^\d{6}$/.test(target)) return false;

  const servicePin = String(workshop.service_pincode || '').trim();
  if (servicePin === target) return true;
  if (servicePin.includes('|')) {
    if (normalizePincodeList(servicePin.replace(/\|/g, ',')).includes(target)) return true;
  }

  const mapped = normalizePincodeList(workshop.mapping_pincodes);
  return mapped.includes(target);
}

export function filterWorkshopsForPincode<T extends WorkshopPinRow>(workshops: T[], pincode: string): T[] {
  return workshops.filter((w) => workshopCoversPincode(w, pincode));
}
