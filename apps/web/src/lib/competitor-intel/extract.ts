import { createHash } from 'crypto';
import type { AioClaim, AioDimension } from '@/lib/competitor-intel/types';

const UA = 'MyFNG-CompetitorIntel/1.0 (+https://myfng.in)';
const DISALLOWED = [/^\/api(\/|$)/i, /^\/report(\/|$)/i, /^\/feedback(\/|$)/i, /^\/ops(\/|$)/i, /^\/wa(\/|$)/i];
const FILE_EXT = /\.(jpg|jpeg|png|gif|webp|svg|pdf|css|js|json|xml|ico|woff2?|map)(\?|$)/i;

function decodeEntities(value: string) {
  return String(value || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, ' ')
    .trim();
}

function stripTags(html: string) {
  return decodeEntities(
    String(html || '')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  );
}

function firstMatch(html: string, re: RegExp) {
  const match = String(html || '').match(re);
  return match ? decodeEntities(stripTags(match[1] || match[2] || '')) : '';
}

function allMatches(html: string, re: RegExp) {
  const out: string[] = [];
  const source = String(html || '');
  const flags = re.flags.includes('g') ? re.flags : `${re.flags}g`;
  const global = new RegExp(re.source, flags);
  let match: RegExpExecArray | null;
  while ((match = global.exec(source))) {
    const text = decodeEntities(stripTags(match[1] || ''));
    if (text) out.push(text);
  }
  return out;
}

export function competitorPageKey(raw: string) {
  try {
    const href = /:\/\//.test(raw) ? raw : `https://${String(raw).replace(/^\/+/, '')}`;
    const url = new URL(href);
    const host = url.hostname.replace(/^www\./i, '').toLowerCase();
    const path = (url.pathname.length > 1 ? url.pathname.replace(/\/+$/, '') : url.pathname || '/') || '/';
    return { host, path, pathLower: path.toLowerCase() };
  } catch {
    const cleaned = String(raw || '').split('?')[0].split('#')[0];
    const rawPath = (cleaned.length > 1 ? cleaned.replace(/\/+$/, '') : cleaned || '/') || '/';
    const path = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
    return { host: '', path, pathLower: path.toLowerCase() };
  }
}

export function loosePath(path: string) {
  return String(path || '/').toLowerCase().replace(/\/+$/, '').replace(/-/g, '') || '/';
}

export function sameCompetitorPage(a?: string | null, b?: string | null) {
  if (!a || !b) return false;
  const left = competitorPageKey(a);
  const right = competitorPageKey(b);
  if (loosePath(left.path) !== loosePath(right.path)) return false;
  if (left.host && right.host) return left.host === right.host;
  return true;
}

export function normalizeCompetitorUrl(raw: string, baseOrigin: string) {
  try {
    const url = new URL(raw, baseOrigin);
    if (!/^https?:$/i.test(url.protocol)) return null;
    if (url.hostname.replace(/^www\./i, '').toLowerCase() !== new URL(baseOrigin).hostname.replace(/^www\./i, '').toLowerCase()) {
      return null;
    }
    if (FILE_EXT.test(url.pathname)) return null;
    if (DISALLOWED.some((re) => re.test(url.pathname))) return null;
    url.hash = '';
    url.search = '';
    url.hostname = url.hostname.toLowerCase();
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, '');
    return url.toString();
  } catch {
    return null;
  }
}

export function parseRobotsDisallow(robotsTxt: string) {
  const extra: RegExp[] = [];
  for (const line of String(robotsTxt || '').split(/\r?\n/)) {
    const match = line.match(/^\s*disallow:\s*(\S+)/i);
    if (!match) continue;
    const path = match[1].trim();
    if (!path || path === '/') continue;
    extra.push(new RegExp(`^${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '.*')}(\\?|$)`, 'i'));
  }
  return extra;
}

export function isDisallowedPath(pathname: string, extra: RegExp[] = []) {
  return [...DISALLOWED, ...extra].some((re) => re.test(pathname));
}

export function parseSitemapLocs(xml: string, origin: string, limit = 40) {
  const locs = allMatches(xml, /<loc>\s*([^<]+)\s*<\/loc>/i);
  const urls: string[] = [];
  for (const loc of locs) {
    const normalized = normalizeCompetitorUrl(loc, origin);
    if (normalized && !urls.includes(normalized)) urls.push(normalized);
    if (urls.length >= limit) break;
  }
  return urls;
}

export function extractPageLinks(html: string, pageUrl: string, origin: string) {
  const hrefs = allMatches(html, /<a\b[^>]*href=["']([^"']+)["']/i);
  const urls: string[] = [];
  for (const href of hrefs) {
    const normalized = normalizeCompetitorUrl(href, pageUrl.startsWith('http') ? pageUrl : origin);
    if (normalized && !urls.includes(normalized)) urls.push(normalized);
  }
  return urls;
}

const AIO_RULES: Array<{ dimension: AioDimension; re: RegExp }> = [
  { dimension: 'app', re: /no app|without (downloading )?an? app|whatsapp-?native|whatsapp only|on whatsapp/i },
  { dimension: 'price', re: /₹\s*[\d,]+|fixed (plan )?price|price fixed|pincode/i },
  { dimension: 'network', re: /\d+\s+(pincodes?|partners?|workshops?|service partners?)/i },
  { dimension: 'warranty', re: /warranty|1 month|1,000 km|1000 km/i },
  { dimension: 'local', re: /mumbai|mulund|vile parle|thane|navi mumbai|kalyan|pune|palghar|nashik/i },
  { dimension: 'hours', re: /\d+\s*(am|pm)\s*(to|–|-)\s*\d+\s*(am|pm)|8 am to 8 pm/i },
];

export function extractAioClaims(parts: string[]): AioClaim[] {
  const blob = parts.filter(Boolean).join(' · ');
  const claims: AioClaim[] = [];
  for (const rule of AIO_RULES) {
    const match = blob.match(rule.re);
    if (!match) continue;
    const start = Math.max(0, (match.index || 0) - 40);
    const snippet = blob.slice(start, start + 140).replace(/\s+/g, ' ').trim();
    claims.push({ dimension: rule.dimension, text: snippet });
  }
  return claims;
}

const STOP = new Set([
  'the', 'and', 'for', 'with', 'from', 'your', 'you', 'our', 'this', 'that', 'are', 'was', 'were',
  'has', 'have', 'not', 'but', 'all', 'can', 'will', 'its', 'into', 'onto', 'than', 'then',
  'every', 'each', 'only', 'also', 'more', 'when', 'what', 'how', 'why', 'who',
]);

const FOCUS = /car|service|repair|ac|brake|tyre|pickup|mumbai|thane|pune|mulund|parle|whatsapp|warranty|app|pincode|workshop|battery|engine|dent/i;

export function extractKeywords(parts: string[], limit = 24) {
  const bag = new Map<string, number>();
  const add = (raw: string, weight: number) => {
    const clean = decodeEntities(raw)
      .toLowerCase()
      .replace(/[^a-z0-9₹\s-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (clean.length < 4 || clean.length > 60) return;
    const words = clean.split(' ').filter((w) => w && !STOP.has(w));
    if (!words.length) return;
    const phrase = words.slice(0, 6).join(' ');
    if (!FOCUS.test(phrase) && words.length < 2) return;
    bag.set(phrase, (bag.get(phrase) || 0) + weight);
  };

  for (const part of parts) add(part, 3);
  const text = parts.join(' ');
  const cityHits = text.match(/car service in [a-z ]{3,24}/gi) || [];
  cityHits.forEach((hit) => add(hit, 5));
  const rupee = text.match(/₹\s*[\d,]+/g) || [];
  rupee.slice(0, 4).forEach((hit) => add(`price ${hit.replace(/\s+/g, '')}`, 2));

  return [...bag.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([keyword]) => keyword);
}

export function hashPageContent(title: string, h1: string, meta: string, text: string) {
  return createHash('sha256')
    .update(`${title}\n${h1}\n${meta}\n${text.slice(0, 2500)}`)
    .digest('hex');
}

export type ParsedCompetitorPage = {
  url: string;
  path: string;
  title: string;
  h1: string;
  metaDescription: string;
  headings: string[];
  text: string;
  wordCount: number;
  keywords: string[];
  aioClaims: AioClaim[];
  links: string[];
  contentHash: string;
};

export function parseCompetitorHtml(html: string, pageUrl: string, origin: string): ParsedCompetitorPage {
  const title = firstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const h1 = firstMatch(html, /<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  const metaDescription =
    firstMatch(html, /<meta\b[^>]*name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i) ||
    firstMatch(html, /<meta\b[^>]*content=["']([^"']+)["'][^>]*name=["']description["'][^>]*>/i);
  const headings = allMatches(html, /<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]>/i).slice(0, 20);
  const text = stripTags(html).slice(0, 8000);
  const keywords = extractKeywords([title, h1, ...headings.slice(0, 8), text.slice(0, 600)]);
  const aioClaims = extractAioClaims([title, h1, metaDescription, ...headings, text.slice(0, 1200)]);
  const url = new URL(pageUrl);
  return {
    url: pageUrl,
    path: url.pathname || '/',
    title,
    h1,
    metaDescription,
    headings,
    text,
    wordCount: text ? text.split(/\s+/).filter(Boolean).length : 0,
    keywords,
    aioClaims,
    links: extractPageLinks(html, pageUrl, origin),
    contentHash: hashPageContent(title, h1, metaDescription, text),
  };
}

export async function fetchPublicHtml(url: string, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    const body = await res.text();
    return { ok: res.ok, status: res.status, finalUrl: res.url || url, body };
  } finally {
    clearTimeout(timer);
  }
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
