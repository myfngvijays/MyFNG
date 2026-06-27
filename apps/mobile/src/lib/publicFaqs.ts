import ENV from '../config/environment';
import { getMobileContentPlatform } from './appPlatform';
import { FAQ_CATEGORIES } from '../constants/publicAppData';
import { RSA_FAQS_FALLBACK } from '../constants/rsaServices';

export type PublicFaqItem = { q: string; a: string };

type CacheEntry = { items: PublicFaqItem[]; fetchedAt: number };
const cache = new Map<string, CacheEntry>();
const CACHE_MS = 5 * 60 * 1000;

function cacheKey(group: string, section: string | undefined, platform: string) {
  return `${group}:${section || 'all'}:${platform}`;
}

function fallbackGeneral(): PublicFaqItem[] {
  return FAQ_CATEGORIES[0]?.items || [];
}

function fallbackService(sectionTitle?: string): PublicFaqItem[] {
  if (!sectionTitle) return FAQ_CATEGORIES[0]?.items || [];
  const found = FAQ_CATEGORIES.find((c) => c.title === sectionTitle);
  return found?.items || fallbackGeneral();
}

function fallbackRsa(): PublicFaqItem[] {
  return RSA_FAQS_FALLBACK;
}

export async function fetchPublicFaqs(options: {
  group: 'GENERAL' | 'SERVICE' | 'RSA';
  section?: string;
  sectionTitle?: string;
  platform?: 'android' | 'ios' | 'web' | 'app';
}): Promise<PublicFaqItem[]> {
  const platform = options.platform || getMobileContentPlatform();
  const key = cacheKey(options.group, options.section, platform);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.fetchedAt < CACHE_MS) return hit.items;

  const params = new URLSearchParams({ group: options.group, platform });
  if (options.section) params.set('section', options.section);

  try {
    const res = await fetch(`${ENV.API_URL}/api/public/faqs?${params.toString()}`);
    if (!res.ok) throw new Error('FAQ fetch failed');
    const json = await res.json();
    const items = Array.isArray(json?.items)
      ? json.items.map((item: any) => ({ q: String(item.q || item.question || ''), a: String(item.a || item.answer || '') }))
          .filter((item: PublicFaqItem) => item.q && item.a)
      : [];
    if (items.length) {
      cache.set(key, { items, fetchedAt: Date.now() });
      return items;
    }
  } catch {
    // retry once after 1s
    try {
      await new Promise((r) => setTimeout(r, 1000));
      const res = await fetch(`${ENV.API_URL}/api/public/faqs?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        const items = Array.isArray(json?.items)
          ? json.items.map((item: any) => ({ q: String(item.q || item.question || ''), a: String(item.a || item.answer || '') }))
              .filter((item: PublicFaqItem) => item.q && item.a)
          : [];
        if (items.length) {
          cache.set(key, { items, fetchedAt: Date.now() });
          return items;
        }
      }
    } catch {
      // fall through to fallback
    }
  }

  if (options.group === 'RSA') return fallbackRsa();
  if (options.group === 'SERVICE') return fallbackService(options.sectionTitle);
  return fallbackGeneral();
}

export function serviceSectionKeyFromTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function preloadPublicFaqs() {
  void fetchPublicFaqs({ group: 'GENERAL', platform: 'app' });
  void fetchPublicFaqs({ group: 'RSA', platform: 'app' });
}
