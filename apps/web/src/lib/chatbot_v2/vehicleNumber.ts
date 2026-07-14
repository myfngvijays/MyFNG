export function normalizeVehicleNumber(raw: unknown): string {
  return String(raw || '')
    .replace(/\s+/g, '')
    .replace(/-/g, '')
    .toUpperCase();
}

/** Accepts common Indian registration formats (e.g. DL01AB1234, MH12AB1234, 22BH1234AB). */
export function isValidVehicleNumber(raw: unknown): boolean {
  const value = normalizeVehicleNumber(raw);
  if (!value || value.length < 6 || value.length > 12) return false;

  const standard = /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{1,4}$/;
  const bharat = /^[0-9]{2}BH[0-9]{4}[A-Z]{2}$/;
  return standard.test(value) || bharat.test(value);
}
