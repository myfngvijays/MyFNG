/**
 * Pricing helpers shared across invoice generation paths.
 */

export function parseMoney(val: any): number {
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
  const n = parseFloat(String(val ?? '0'));
  return Number.isFinite(n) ? n : 0;
}

/**
 * lead_pricing_items can store either:
 * - final_price (preferred)
 * - base_price (fallback)
 *
 * Some deployments only populate base_price; UI/PDF should still show correct rates.
 */
export function getEffectivePricingItemAmount(item: any): number {
  const finalP = parseMoney(item?.final_price);
  if (finalP > 0) return finalP;
  const baseP = parseMoney(item?.base_price);
  if (baseP > 0) return baseP;
  return 0;
}

export function getEffectiveQty(item: any, defaultQty = 1): number {
  const qRaw = item?.quantity ?? item?.qty ?? defaultQty;
  const q = parseFloat(String(qRaw ?? defaultQty));
  return Number.isFinite(q) && q > 0 ? q : defaultQty;
}

