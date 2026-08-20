/** Stamp default CRM disposition Fresh onto coupon_meta when blank. */

export function stampFreshCrmDisposition(
  meta: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const next = meta && typeof meta === 'object' ? { ...meta } : {};
  const result = String(next.last_call_result || '')
    .trim()
    .toUpperCase();
  if (result) return next;
  next.last_call_result = 'FRESH';
  next.last_call_label = 'Fresh';
  return next;
}
