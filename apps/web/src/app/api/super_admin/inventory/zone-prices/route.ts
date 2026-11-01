import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const CLASS_ORDER = [
  'DEFAULT',
  'HATCHBACK',
  'COMPACT SUV',
  'SEDANS',
  'PREMIUM HATCHBACK',
  'SUV/MUVs',
  'PREMIUM SUV/MUVs',
  'PREMIUM LUXURY',
];

function classKey(value: string | null | undefined) {
  const raw = String(value || '').trim();
  if (!raw) return 'DEFAULT';
  const known = CLASS_ORDER.find((item) => item.toLowerCase() === raw.toLowerCase());
  return known || raw.toUpperCase();
}

const CATEGORY_ORDER = ['periodic', 'ac', 'brake', 'battery', 'engine', 'clutch', 'wheel', 'tyre', 'dent', 'detail', 'suspension', 'electric'];

function categoryRank(name: string) {
  const key = name.toLowerCase();
  const index = CATEGORY_ORDER.findIndex((item) => key.includes(item));
  return index === -1 ? CATEGORY_ORDER.length : index;
}

function classRank(value: string) {
  const index = CLASS_ORDER.findIndex((item) => item.toLowerCase() === value.toLowerCase());
  return index === -1 ? CLASS_ORDER.length : index;
}

function isPrimeZone(name: string) {
  return /\bprime\b/i.test(name);
}

function isUrbanZone(name: string) {
  return /\burban\b/i.test(name) && !/suburban/i.test(name);
}

const CATEGORY_ICONS: Array<{ test: RegExp; icon: string }> = [
  { test: /periodic/i, icon: '/icon-periodic-service.webp' },
  { test: /engine/i, icon: '/icon-engine-service.webp' },
  { test: /\bac\b/i, icon: '/icon-ac-service.webp' },
  { test: /brake/i, icon: '/icon-brake-service.webp' },
  { test: /electric/i, icon: '/icon-electrical-service.webp' },
  { test: /battery/i, icon: '/icon-battery-service.webp' },
  { test: /clutch/i, icon: '/icon-clutch-service.webp' },
  { test: /tyre|wheel/i, icon: '/icon-tyre-service.webp' },
  { test: /detail/i, icon: '/icon-detailing-service.webp' },
  { test: /dent|paint/i, icon: '/icon-denting-service.webp' },
  { test: /suspension|steering/i, icon: '/icon-suspension-service.webp' },
];

function categoryIcon(name: string) {
  return CATEGORY_ICONS.find((item) => item.test.test(name))?.icon || '';
}

async function assertSuperAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) return { ok: false as const, status: 401, error: 'Unauthorized', supabase: null };

  const { data: userData, error: roleError } = await supabase
    .from('users_login')
    .select('id, roles!inner(role_code)')
    .eq('id', user.id)
    .single();
  const roleCode = (userData as { roles?: { role_code?: string } } | null)?.roles?.role_code;
  if (roleError || !userData || !['SUPER_ADMIN', 'SUB_ADMIN'].includes(String(roleCode || ''))) {
    return { ok: false as const, status: 403, error: 'Forbidden', supabase: null };
  }
  return { ok: true as const, status: 200, error: null, supabase };
}

export async function GET() {
  const auth = await assertSuperAdmin();
  if (!auth.ok || !auth.supabase) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const supabase = auth.supabase;

  const { data: zoneRows, error: zoneError } = await supabase
    .from('zones')
    .select('id, name')
    .eq('is_active', true)
    .order('name');
  if (zoneError) return NextResponse.json({ error: zoneError.message }, { status: 500 });

  const zones = zoneRows || [];
  const picked = zones
    .filter((zone) => isPrimeZone(String(zone.name || '')) || isUrbanZone(String(zone.name || '')))
    .sort((a, b) => {
      const rank = (name: string) => (isPrimeZone(name) ? 0 : 1);
      return rank(String(a.name || '')) - rank(String(b.name || '')) || String(a.name || '').localeCompare(String(b.name || ''));
    });
  if (!picked.length) {
    return NextResponse.json({
      zones: [],
      available_zones: zones.map((zone) => zone.name),
      classes: [],
      categories: [],
      services: [],
    });
  }

  const [{ data: serviceRows, error: serviceError }, { data: categoryRows }] = await Promise.all([
    supabase.from('service_types').select('id, name, category_uuid').eq('is_active', true).order('name').limit(5000),
    supabase.from('categories').select('uuid, category').limit(200),
  ]);
  if (serviceError) return NextResponse.json({ error: serviceError.message }, { status: 500 });
  const categoryName = new Map((categoryRows || []).map((row) => [row.uuid, String(row.category || '').trim() || 'Other']));

  const zoneLevel = new Map<string, Map<number, number>>();
  const anyLevel = new Map<string, Map<number, number>>();
  const pageSize = 1000;
  const addCount = (bucketMap: Map<string, Map<number, number>>, key: string, price: number) => {
    const bucket = bucketMap.get(key) || new Map<number, number>();
    bucket.set(price, (bucket.get(price) || 0) + 1);
    bucketMap.set(key, bucket);
  };
  for (const zone of picked) {
    for (let page = 0; page < 120; page += 1) {
      const from = page * pageSize;
      const { data, error } = await supabase
        .from('workshop_service_pricing')
        .select('service_type_id, zone_id, class, city_id, custom_price')
        .eq('zone_id', zone.id)
        .eq('is_active', true)
        .order('id', { ascending: true })
        .range(from, from + pageSize - 1);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      const rows = data || [];
      for (const row of rows) {
        const price = Number(row.custom_price);
        if (!Number.isFinite(price)) continue;
        const key = `${row.service_type_id}\u0001${zone.id}\u0001${classKey(row.class)}`;
        addCount(anyLevel, key, price);
        if (!row.city_id) addCount(zoneLevel, key, price);
      }
      if (rows.length < pageSize) break;
    }
  }
  const counts = new Map<string, Map<number, number>>();
  for (const [key, bucket] of anyLevel) counts.set(key, zoneLevel.get(key) || bucket);

  const classSet = new Set<string>();
  const byService = new Map<string, { id: string; name: string; category: string; prices: Record<string, Record<string, { price: number; varies: boolean }>> }>();
  for (const service of serviceRows || []) {
    const prices: Record<string, Record<string, { price: number; varies: boolean }>> = {};
    for (const zone of picked) prices[zone.id] = {};
    byService.set(service.id, {
      id: service.id,
      name: service.name || 'Service',
      category: categoryName.get(service.category_uuid) || 'Other',
      prices,
    });
  }
  for (const [key, bucket] of counts) {
    const [serviceId, zoneId, cls] = key.split('\u0001');
    const service = byService.get(serviceId);
    if (!service || !service.prices[zoneId]) continue;
    let bestPrice = 0;
    let bestCount = -1;
    for (const [price, count] of bucket) {
      if (count > bestCount) {
        bestPrice = price;
        bestCount = count;
      }
    }
    service.prices[zoneId][cls] = { price: bestPrice, varies: bucket.size > 1 };
    classSet.add(cls);
  }
  const services = [...byService.values()]
    .filter((service) => Object.values(service.prices).some((zonePrices) => Object.keys(zonePrices).length > 0))
    .sort((a, b) => categoryRank(a.category) - categoryRank(b.category) || a.name.localeCompare(b.name));

  const classes = [...classSet].sort((a, b) => classRank(a) - classRank(b) || a.localeCompare(b));
  const categories = [...new Set(services.map((service) => service.category))]
    .sort((a, b) => categoryRank(a) - categoryRank(b) || a.localeCompare(b))
    .map((name) => ({ name, icon: categoryIcon(name) }));

  return NextResponse.json({
    zones: picked.map((zone) => ({
      id: zone.id,
      name: zone.name,
      key: isPrimeZone(String(zone.name || '')) ? 'prime' : 'urban',
    })),
    available_zones: zones.map((zone) => zone.name),
    classes,
    categories,
    services,
  });
}
