/** Extract INR amounts from search snippets, titles, and page text. */
export function parseInrPrices(text: string): number[] {
  const raw = String(text || '');
  const found: number[] = [];

  const patterns = [
    /₹\s*([\d,]+(?:\.\d+)?)/gi,
    /Rs\.?\s*([\d,]+(?:\.\d+)?)/gi,
    /INR\s*([\d,]+(?:\.\d+)?)/gi,
    /([\d,]{3,})\s*(?:\/-|-\s*₹|INR|rupees?)/gi,
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(raw)) !== null) {
      const value = Number(String(match[1] || '').replace(/,/g, ''));
      if (Number.isFinite(value) && value >= 50 && value <= 500_000) {
        found.push(Math.round(value));
      }
    }
  }

  return found;
}

export function priceRangeFromSamples(samples: number[]): { low: number; high: number } | null {
  if (!samples.length) return null;
  const sorted = [...samples].sort((a, b) => a - b);
  const low = sorted[0];
  const high = sorted[sorted.length - 1];
  if (high < low) return null;
  return { low, high: Math.max(high, low + Math.round(low * 0.05)) };
}

export function mergePriceRanges(
  ranges: Array<{ low: number; high: number } | null | undefined>,
): { low: number; high: number } | null {
  const valid = ranges.filter(Boolean) as Array<{ low: number; high: number }>;
  if (!valid.length) return null;
  const low = Math.min(...valid.map((r) => r.low));
  const high = Math.max(...valid.map((r) => r.high));
  return { low, high: Math.max(high, low) };
}
