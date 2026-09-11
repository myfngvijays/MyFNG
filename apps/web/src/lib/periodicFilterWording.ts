/** Premium / Platinum periodic: Replace filters except Premium SUV/MUVs & Premium Luxury. */

export type PeriodicFilterContext = {
  carClass?: string | null;
  serviceName?: string | null;
  points?: number | null;
  category?: string | null;
};

export function shouldKeepCleanFilters(carClass?: string | null): boolean {
  const c = String(carClass || '')
    .trim()
    .toUpperCase()
    .replace(/LUXURRY/g, 'LUXURY');
  if (!c) return false;
  if (c.includes('PREMIUM LUXURY')) return true;
  if (c.includes('PREMIUM SUV')) return true;
  return false;
}

export function isPremiumOrPlatinumPeriodic(input: PeriodicFilterContext): boolean {
  const pts = Number(input.points || 0);
  if (pts === 50 || pts === 60) return true;

  const name = String(input.serviceName || '').toUpperCase();
  const cat = String(input.category || '').toUpperCase();
  const periodicish =
    cat.includes('PERIODIC') || name.includes('PERIODIC') || /\b(50|60)\s*POINT/.test(name);

  if (name.includes('PLATINUM') && (periodicish || name.includes('SERVICE') || name.includes('POINT'))) {
    return true;
  }
  if (name.includes('PREMIUM') && (periodicish || name.includes('SERVICE') || name.includes('50'))) {
    return true;
  }
  return false;
}

function normName(name: string) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function isEngineAirFilter(name: string) {
  return /^(clean(ing)?|replace) air filter$/.test(normName(name));
}

function isCabinAcFilter(name: string) {
  return /^(clean(ing)?|replace) cabin( ac)? filter$/.test(normName(name));
}

function itemLabel(item: unknown): string {
  if (typeof item === 'string') return item;
  const it = item as { name?: string; item_name?: string; title?: string; label?: string } | null;
  return String(it?.name || it?.item_name || it?.title || it?.label || '');
}

function withLabel<T>(item: T, name: string): T {
  if (typeof item === 'string') return name as T;
  if (item && typeof item === 'object') {
    const it = item as Record<string, unknown>;
    if ('item_name' in it && !('name' in it)) return { ...it, item_name: name } as T;
    return { ...it, name } as T;
  }
  return item;
}

export function applyPeriodicFilterWording<T>(items: T[], ctx: PeriodicFilterContext): T[] {
  if (!Array.isArray(items) || items.length === 0) return items;
  if (!isPremiumOrPlatinumPeriodic(ctx)) return items;

  const keepClean = shouldKeepCleanFilters(ctx.carClass);
  const air = keepClean ? 'Clean Air Filter' : 'Replace Air Filter';
  const cabin = keepClean ? 'Clean Cabin AC Filter' : 'Replace Cabin AC Filter';

  return items.map((item) => {
    const label = itemLabel(item);
    if (isEngineAirFilter(label)) return withLabel(item, air);
    if (isCabinAcFilter(label)) return withLabel(item, cabin);
    return item;
  });
}

/** Store Replace on Premium/Platinum master templates (most cars). Display still switches to Clean for Premium SUV/Luxury. */
export function rewriteStoredFilterNamesToReplace<T>(items: T[]): T[] {
  if (!Array.isArray(items) || items.length === 0) return items;
  return items.map((item) => {
    const label = itemLabel(item);
    if (isEngineAirFilter(label)) return withLabel(item, 'Replace Air Filter');
    if (isCabinAcFilter(label)) return withLabel(item, 'Replace Cabin AC Filter');
    return item;
  });
}

export function storedFilterNamesNeedReplace(items: unknown[]): boolean {
  return (items || []).some((item) => {
    const label = itemLabel(item);
    const n = normName(label);
    return /^(clean(ing)?) air filter$/.test(n) || /^(clean(ing)?) cabin( ac)? filter$/.test(n);
  });
}
