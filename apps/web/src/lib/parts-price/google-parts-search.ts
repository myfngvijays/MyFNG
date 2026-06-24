import { mergePriceRanges, parseInrPrices } from './parse-inr-prices';

export type WebSearchHit = {
  title: string;
  snippet: string;
  link: string;
  prices: number[];
};

type GoogleCseItem = {
  title?: string;
  snippet?: string;
  link?: string;
  pagemap?: {
    offer?: Array<{ price?: string }>;
    product?: Array<{ price?: string }>;
  };
};

function cseConfig(): { apiKey: string; cx: string } | null {
  const apiKey = String(
    process.env.GOOGLE_CSE_API_KEY ||
      process.env.GOOGLE_CUSTOM_SEARCH_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      '',
  ).trim();
  const cx = String(process.env.GOOGLE_CSE_CX || process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID || '').trim();
  if (!apiKey || !cx) return null;
  return { apiKey, cx };
}

function pricesFromItem(item: GoogleCseItem): number[] {
  const chunks = [item.title || '', item.snippet || ''];
  const structured = [
    ...(item.pagemap?.offer || []).map((o) => o.price || ''),
    ...(item.pagemap?.product || []).map((p) => p.price || ''),
  ];
  return parseInrPrices([...chunks, ...structured].join(' '));
}

export async function googleCustomSearch(query: string, limit = 5): Promise<WebSearchHit[]> {
  const cfg = cseConfig();
  if (!cfg) return [];

  const url = new URL('https://www.googleapis.com/customsearch/v1');
  url.searchParams.set('key', cfg.apiKey);
  url.searchParams.set('cx', cfg.cx);
  url.searchParams.set('q', query);
  url.searchParams.set('num', String(Math.min(Math.max(limit, 1), 10)));
  url.searchParams.set('gl', 'in');
  url.searchParams.set('hl', 'en');

  const res = await fetch(url.toString(), { next: { revalidate: 3600 } });
  if (!res.ok) {
    console.warn('[google-parts-search] CSE failed:', res.status, await res.text().catch(() => ''));
    return [];
  }

  const json = (await res.json()) as { items?: GoogleCseItem[] };
  return (json.items || []).map((item) => ({
    title: String(item.title || ''),
    snippet: String(item.snippet || ''),
    link: String(item.link || ''),
    prices: pricesFromItem(item),
  }));
}

export async function searchGooglePartPrice(params: {
  make: string;
  model: string;
  partName: string;
  city?: string | null;
}): Promise<{ hits: WebSearchHit[]; range: { low: number; high: number } | null }> {
  const cityBit = params.city ? ` ${params.city}` : '';
  const query = `${params.make} ${params.model} ${params.partName} spare part price india${cityBit}`.trim();
  const hits = await googleCustomSearch(query, 6);
  const range = mergePriceRanges(hits.map((h) => {
    const prices = h.prices;
    if (!prices.length) return null;
    const sorted = [...prices].sort((a, b) => a - b);
    return { low: sorted[0], high: sorted[sorted.length - 1] };
  }));
  return { hits, range };
}

export async function searchBoodmoViaGoogle(params: {
  make: string;
  model: string;
  partName: string;
}): Promise<{ hits: WebSearchHit[]; range: { low: number; high: number } | null }> {
  const query = `site:boodmo.com ${params.make} ${params.model} ${params.partName} price`.trim();
  const hits = (await googleCustomSearch(query, 6)).filter((h) => h.link.includes('boodmo.com'));
  const range = mergePriceRanges(
    hits.map((h) => {
      if (!h.prices.length) return null;
      const sorted = [...h.prices].sort((a, b) => a - b);
      return { low: sorted[0], high: sorted[sorted.length - 1] };
    }),
  );
  return { hits, range };
}
