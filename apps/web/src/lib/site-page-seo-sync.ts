import { CITY_PAGES } from '@/lib/city-pages';
import { DEFAULT_SERVICES, INTERNAL_SLUG_TO_MARKETING } from '@/lib/services/catalog';
import {
  buildSitePageSeoInsert,
  normalizePagePath,
  SITE_PAGE_SEO_DEFAULTS,
  SITE_PAGE_SEO_TABLE,
} from '@/lib/site-page-seo';
import { buildServicePagePath } from '@/lib/service-page-seo';

export type SeoPathSyncScope = 'all' | 'service' | 'city';

export type SeoPathSyncResult = {
  remapped: Array<{ from: string; to: string }>;
  removed_duplicates: string[];
  inserted: string[];
};

function addMap(map: Map<string, string>, from: string, to: string) {
  const source = normalizePagePath(from);
  const target = normalizePagePath(to);
  if (!source || !target || source === target) return;
  map.set(source, target);
}

export function buildLegacySeoPathMap(): Map<string, string> {
  const map = new Map<string, string>();

  for (const service of DEFAULT_SERVICES) {
    const next = buildServicePagePath(INTERNAL_SLUG_TO_MARKETING[service.slug]);
    addMap(map, `/car-services/${service.slug}`, next);
    addMap(map, `/services/${service.slug}`, next);
  }
  addMap(map, '/car-services/car-battery', '/car-services/car-battery-service');
  addMap(map, '/services/periodic-service', '/car-services/periodic-car-service');
  addMap(map, '/services/engine-service', '/car-services/car-engine-service');
  addMap(map, '/services/ac-service', '/car-services/car-ac-service');
  addMap(map, '/services/battery-service', '/car-services/car-battery-service');
  addMap(map, '/services/brake-service', '/car-services/car-brake-service');
  addMap(map, '/services/clutch-service', '/car-services/car-clutch-service');
  addMap(map, '/services/detailing-service', '/car-services/car-detailing-service');
  addMap(map, '/services/denting-painting', '/car-services/car-denting-painting');
  addMap(map, '/services/electrical-battery-service', '/car-services/car-electrical-battery-service');
  addMap(map, '/services/suspension-steering-service', '/car-services/car-suspension-steering-service');

  for (const city of CITY_PAGES) {
    addMap(map, `/car-service-in/${city.slug}`, city.pagePath);
  }

  addMap(map, '/about', '/about-us');
  addMap(map, '/contact', '/contact-us');
  addMap(map, '/faq', '/faqs');
  addMap(map, '/blog', '/blogs');
  addMap(map, '/services', '/car-services');
  addMap(map, '/rsa_landing', '/car-roadside-assistance');
  addMap(map, '/roadside-assistance', '/car-roadside-assistance');
  addMap(map, '/car-roadside-assitance', '/car-roadside-assistance');

  return map;
}

export function resolveCanonicalSeoPath(path: string): string {
  const map = buildLegacySeoPathMap();
  const normalized = normalizePagePath(path);
  return map.get(normalized) || normalized;
}

function defaultsForScope(scope: SeoPathSyncScope) {
  if (scope === 'service') {
    return SITE_PAGE_SEO_DEFAULTS.filter((row) => row.page_path.startsWith('/car-services/'));
  }
  if (scope === 'city') {
    return SITE_PAGE_SEO_DEFAULTS.filter((row) => row.page_path.startsWith('/car-service-in-'));
  }
  return SITE_PAGE_SEO_DEFAULTS;
}

export async function syncSitePageSeoPaths(db: any, scope: SeoPathSyncScope = 'all'): Promise<SeoPathSyncResult> {
  const map = buildLegacySeoPathMap();
  const result: SeoPathSyncResult = { remapped: [], removed_duplicates: [], inserted: [] };

  const { data: existingRows, error: existingError } = await db
    .from(SITE_PAGE_SEO_TABLE)
    .select('id, page_path, canonical_path');
  if (existingError) throw new Error(existingError.message);

  const rows = (existingRows || []) as Array<{ id: string; page_path: string; canonical_path: string | null }>;
  const byPath = new Map(rows.map((row) => [normalizePagePath(row.page_path), row]));

  for (const row of rows) {
    const from = normalizePagePath(row.page_path);
    const to = map.get(from);
    if (!to) {
      const nextCanonical = map.get(normalizePagePath(row.canonical_path || '')) || null;
      if (nextCanonical && nextCanonical !== normalizePagePath(row.canonical_path || '')) {
        const { error } = await db
          .from(SITE_PAGE_SEO_TABLE)
          .update({ canonical_path: nextCanonical, updated_at: new Date().toISOString() })
          .eq('id', row.id);
        if (error) throw new Error(error.message);
        result.remapped.push({ from: `${from} (canonical)`, to: nextCanonical });
      }
      continue;
    }

    const conflict = byPath.get(to);
    if (conflict && conflict.id !== row.id) {
      const { error } = await db.from(SITE_PAGE_SEO_TABLE).delete().eq('id', row.id);
      if (error) throw new Error(error.message);
      byPath.delete(from);
      result.removed_duplicates.push(from);
      continue;
    }

    const nextCanonical = map.get(normalizePagePath(row.canonical_path || from)) || to;
    const { error } = await db
      .from(SITE_PAGE_SEO_TABLE)
      .update({
        page_path: to,
        canonical_path: nextCanonical,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id);
    if (error) throw new Error(error.message);
    byPath.delete(from);
    byPath.set(to, { ...row, page_path: to, canonical_path: nextCanonical });
    result.remapped.push({ from, to });
  }

  const missing = defaultsForScope(scope).filter((row) => !byPath.has(normalizePagePath(row.page_path)));
  if (missing.length) {
    const payload = missing.map((row) => buildSitePageSeoInsert(row));
    const { data, error } = await db.from(SITE_PAGE_SEO_TABLE).insert(payload).select('page_path');
    if (error) throw new Error(error.message);
    for (const row of data || []) {
      result.inserted.push(normalizePagePath(row.page_path));
    }
  }

  return result;
}
