import crypto from 'crypto';
import { mergePriceRanges, parseInrPrices, priceRangeFromSamples } from './parse-inr-prices';

const BOODMO_ORIGIN = 'https://boodmo.com';
const BOODMO_API_BASE = `${BOODMO_ORIGIN}/api/v1/customer`;
const CLIENT_VERSION = process.env.BOODMO_CLIENT_VERSION || '3.24.0';
const CLIENT_BUILD = process.env.BOODMO_CLIENT_BUILD || '1.0.0';

type ClientToken = { token: string; ttl?: number };

let cachedToken: ClientToken | null = null;
let cachedTokenAt = 0;

function md5(input: string): string {
  return crypto.createHash('md5').update(input).digest('hex');
}

function visitorId(): string {
  return crypto.randomUUID();
}

function booSign(pathWithQuery: string, clientToken: string, clientId: string): string {
  const path = decodeURIComponent(pathWithQuery).replace(/^.*\/\/[^/]+/, '');
  return md5(`${clientId}|${path}|${clientToken}|${CLIENT_VERSION}|web`);
}

function baseHeaders(clientId: string, clientToken?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Client-App': 'web',
    'X-Client-Build': CLIENT_BUILD,
    'X-Client-Version': CLIENT_VERSION,
    'X-Client-Id': clientId,
    'X-Date': new Date().toISOString(),
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    Referer: `${BOODMO_ORIGIN}/catalog/`,
    Origin: BOODMO_ORIGIN,
  };
  if (clientToken) headers['X-Client-Token'] = clientToken;
  return headers;
}

async function fetchClientToken(clientId: string): Promise<ClientToken | null> {
  if (cachedToken && Date.now() - cachedTokenAt < 10 * 60 * 1000) return cachedToken;

  const candidates = [
    `${BOODMO_API_BASE}/core/app-status`,
    `${BOODMO_API_BASE}/core/status`,
    `${BOODMO_ORIGIN}/api/v1/core/app-status`,
  ];

  for (const url of candidates) {
    try {
      const path = url.replace(BOODMO_ORIGIN, '');
      const tokenGuess = cachedToken?.token || '';
      const headers = {
        ...baseHeaders(clientId, tokenGuess || undefined),
        'X-Boo-Sign': booSign(path, tokenGuess, clientId),
      };
      const res = await fetch(url, { headers, cache: 'no-store' });
      if (!res.ok) continue;
      const json = (await res.json()) as Record<string, unknown>;
      const tokenObj =
        (json['X-Client-Token'] as ClientToken | undefined) ||
        (json['x-client-token'] as ClientToken | undefined) ||
        (typeof json.token === 'string' ? { token: json.token } : null);
      if (tokenObj?.token) {
        cachedToken = tokenObj;
        cachedTokenAt = Date.now();
        return tokenObj;
      }
    } catch {
      // try next candidate
    }
  }
  return null;
}

type BoodmoPartRow = {
  name?: string;
  title?: string;
  price?: number | string;
  min_price?: number;
  max_price?: number;
  offers?: Array<{ price?: number | string; sale_price?: number | string }>;
};

function pricesFromPartRow(row: BoodmoPartRow): number[] {
  const chunks: string[] = [];
  if (row.name) chunks.push(row.name);
  if (row.title) chunks.push(row.title);
  if (row.price != null) chunks.push(String(row.price));
  if (row.min_price != null) chunks.push(String(row.min_price));
  if (row.max_price != null) chunks.push(String(row.max_price));
  for (const offer of row.offers || []) {
    if (offer.price != null) chunks.push(String(offer.price));
    if (offer.sale_price != null) chunks.push(String(offer.sale_price));
  }
  const parsed = parseInrPrices(chunks.join(' '));
  const numeric = [
    row.price,
    row.min_price,
    row.max_price,
    ...(row.offers || []).flatMap((o) => [o.price, o.sale_price]),
  ]
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n) && n >= 50 && n <= 500_000)
    .map((n) => Math.round(n));
  return [...parsed, ...numeric];
}

function rowsFromPayload(json: unknown): BoodmoPartRow[] {
  if (!json || typeof json !== 'object') return [];
  const obj = json as Record<string, unknown>;
  const lists = [obj.items, obj.data, obj.results, obj.parts, obj.offers];
  for (const list of lists) {
    if (Array.isArray(list) && list.length) return list as BoodmoPartRow[];
  }
  return [];
}

export async function searchBoodmoPartPrice(params: {
  make: string;
  model: string;
  partName: string;
}): Promise<{ range: { low: number; high: number } | null; matched: number }> {
  const clientId = visitorId();
  const token = await fetchClientToken(clientId);
  const searchQuery = `${params.make} ${params.model} ${params.partName}`.trim();

  const endpoints = [
    {
      url: `${BOODMO_API_BASE}/catalog/part/list?searchQuery=${encodeURIComponent(searchQuery)}&limit=12&offset=1`,
      path: `/api/v1/customer/catalog/part/list?searchQuery=${encodeURIComponent(searchQuery)}&limit=12&offset=1`,
    },
    {
      url: `${BOODMO_API_BASE}/api/pim/part/search?searchQuery=${encodeURIComponent(searchQuery)}&limit=12&offset=1`,
      path: `/api/v1/customer/api/pim/part/search?searchQuery=${encodeURIComponent(searchQuery)}&limit=12&offset=1`,
    },
  ];

  const allPrices: number[] = [];

  for (const endpoint of endpoints) {
    try {
      const headers = {
        ...baseHeaders(clientId, token?.token),
        'X-Boo-Sign': booSign(endpoint.path, token?.token || '', clientId),
        'X-Visitor-Id': clientId,
      };
      const res = await fetch(endpoint.url, { headers, cache: 'no-store' });
      if (!res.ok) continue;
      const json = await res.json();
      const rows = rowsFromPayload(json);
      for (const row of rows) allPrices.push(...pricesFromPartRow(row));
      if (allPrices.length) break;
    } catch (err) {
      console.warn('[boodmo-client] search failed:', err);
    }
  }

  const range = priceRangeFromSamples(allPrices);
  return { range, matched: allPrices.length };
}

export async function searchBoodmoCategory(params: {
  make: string;
  model: string;
  partNames: string[];
}): Promise<{ range: { low: number; high: number } | null }> {
  const ranges = await Promise.all(
    params.partNames.slice(0, 2).map((partName) =>
      searchBoodmoPartPrice({ make: params.make, model: params.model, partName }).then((r) => r.range),
    ),
  );
  return { range: mergePriceRanges(ranges) };
}
