import type { Ionicons } from '@expo/vector-icons';
import { PERIODIC_PACKAGES, formatInrRange } from './smartToolsLogic';
import { supabase } from './supabase';
import type { CustomerVehicle } from './smartToolsVehicle';
import { fetchServicePriceForBooking } from './servicePricing';

export type CityRow = {
  id: string;
  name: string;
  state?: string | null;
  zone_id?: string | null;
  is_active?: boolean;
};

export type CarModelOption = {
  id: string;
  make: string;
  model_name: string;
  variant?: string | null;
  class?: string | null;
};

export type SelectedCar = {
  label: string;
  make: string;
  model: string;
  modelId?: string;
  vehicleClass?: string | null;
  source: 'saved' | 'manual';
  vehicle?: CustomerVehicle;
};

export type CompareCategory = {
  key: string;
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
  serviceCount: number;
};

export type CompareQuote = {
  id: string;
  name: string;
  checkpoints: number;
  highlights: string[];
  authorisedLow: number;
  authorisedHigh: number;
  myfngLow: number;
  myfngHigh: number;
  myfngBase: number;
  discountLabel: string;
  serviceTypeId?: string;
  priceSource: 'live' | 'indicative';
};

const PERIODIC_DEFS = [
  {
    id: 'basic',
    patterns: ['semi synthetic', 'basic service'],
    checkpoints: 15,
    highlights: ['Engine oil change', 'Oil filter', 'Brake inspection', 'Fluid top-up'],
  },
  {
    id: 'general',
    patterns: ['semi synthetic general', 'general service'],
    checkpoints: 30,
    highlights: ['Everything in Basic', 'Air filter clean', 'Battery check', 'AC inspection'],
  },
  {
    id: 'premium',
    patterns: ['semi synthetic premium', 'premium service'],
    checkpoints: 50,
    highlights: ['Everything in General', 'Diagnostics scan', 'Fuel system check', 'Interior vacuum'],
  },
  {
    id: 'platinum',
    patterns: ['platinum service'],
    checkpoints: 60,
    highlights: ['Everything in Premium', 'Seat shampoo', 'Machine polish', 'Engine dressing'],
  },
] as const;

const CATEGORY_ORDER = [
  'PERIODIC',
  'ENGINE',
  'AC',
  'BATTERY',
  'BRAKE',
  'CLUTCH',
  'TYRE',
  'WHEEL',
  'DETAILING',
  'DENTING',
  'PAINTING',
  'ELECTRICAL',
  'SUSPENSION',
  'STEERING',
];

const CATEGORY_UI: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }> = {
  PERIODIC: { icon: 'construct', color: '#2563EB', bg: '#EFF6FF' },
  ENGINE: { icon: 'speedometer', color: '#EA580C', bg: '#FFF7ED' },
  AC: { icon: 'snow', color: '#0891B2', bg: '#ECFEFF' },
  BATTERY: { icon: 'battery-charging', color: '#059669', bg: '#ECFDF5' },
  BRAKE: { icon: 'disc', color: '#DC2626', bg: '#FEF2F2' },
  CLUTCH: { icon: 'cog', color: '#7C3AED', bg: '#F5F3FF' },
  TYRE: { icon: 'ellipse-outline', color: '#1F2937', bg: '#F3F4F6' },
  WHEEL: { icon: 'radio-button-on', color: '#475569', bg: '#F1F5F9' },
  DETAILING: { icon: 'sparkles', color: '#DB2777', bg: '#FDF2F8' },
  DENTING: { icon: 'hammer', color: '#B45309', bg: '#FFFBEB' },
  PAINTING: { icon: 'color-palette', color: '#9333EA', bg: '#FAF5FF' },
  ELECTRICAL: { icon: 'flash', color: '#CA8A04', bg: '#FEFCE8' },
  SUSPENSION: { icon: 'car-sport', color: '#0369A1', bg: '#F0F9FF' },
  STEERING: { icon: 'navigate', color: '#0D9488', bg: '#F0FDFA' },
};

const DEFAULT_CATEGORY_UI = { icon: 'build' as const, color: '#2563EB', bg: '#EFF6FF' };

export function formatCategoryLabel(raw: string): string {
  return raw
    .split(/[\s/_-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export function formatModelLabel(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => {
      if (/^(n|ev|rs|gt|xr|xl|i\d+|cng)$/i.test(w)) return w.toUpperCase();
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(' ');
}

export function myfngPriceRange(basePrice: number): { low: number; high: number } {
  if (!basePrice || basePrice <= 0) return { low: 0, high: 0 };
  return { low: basePrice - 200, high: basePrice + 200 };
}

export function authorisedPriceRange(myfngMid: number): { low: number; high: number } {
  if (!myfngMid || myfngMid <= 0) return { low: 0, high: 0 };
  return {
    low: Math.round((myfngMid * 1.4) / 100) * 100,
    high: Math.round((myfngMid * 1.9) / 100) * 100,
  };
}

export function savingsLabel(authorisedLow: number, myfngHigh: number): string {
  if (!authorisedLow || !myfngHigh) return 'Save with MyFNG';
  const pct = Math.round(((authorisedLow - myfngHigh) / authorisedLow) * 100);
  return pct > 0 ? `Save up to ${pct}%` : 'Save with MyFNG';
}

export async function fetchActiveCities(): Promise<CityRow[]> {
  try {
    const { data, error } = await supabase
      .from('cities')
      .select('id,name,state,zone_id,is_active')
      .eq('is_active', true)
      .order('name');
    if (error) throw error;
    return ((data as CityRow[]) || []).filter((c) => c.id && c.name);
  } catch {
    return [
      { id: 'fallback-mumbai', name: 'Mumbai', state: 'Maharashtra' },
      { id: 'fallback-thane', name: 'Thane', state: 'Maharashtra' },
      { id: 'fallback-pune', name: 'Pune', state: 'Maharashtra' },
    ];
  }
}

/** Prefer exact district (Thane) before metro (Mumbai) for pricing. */
export function resolveCityFromLabel(label: string, cities: CityRow[]): CityRow | null {
  const raw = String(label || '').trim();
  if (!raw || raw === 'India' || raw === 'Your City') return null;

  const parts = raw
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);

  const tryMatch = (needle: string) => {
    const n = needle.toLowerCase();
    return (
      cities.find((c) => c.name.toLowerCase() === n) ||
      cities.find((c) => n.includes(c.name.toLowerCase())) ||
      cities.find((c) => c.name.toLowerCase().includes(n))
    );
  };

  for (const part of parts) {
    const hit = tryMatch(part);
    if (hit) return hit;
  }
  return tryMatch(raw);
}

export async function fetchModelsByBrand(brand: string): Promise<CarModelOption[]> {
  const token = brand.trim().split(/\s+/)[0] || brand.trim();
  if (!token) return [];

  try {
    const { data, error } = await supabase
      .from('car_models')
      .select('id, make, model_name, variant, class')
      .eq('is_active', true)
      .ilike('make', `%${token}%`)
      .order('model_name')
      .limit(250);
    if (error) throw error;

    const seen = new Set<string>();
    const out: CarModelOption[] = [];
    for (const row of (data as CarModelOption[]) || []) {
      const key = String(row.model_name || '').trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(row);
    }
    return out;
  } catch {
    return [];
  }
}

export async function resolveSavedVehicleModel(vehicle: CustomerVehicle): Promise<CarModelOption | null> {
  const make = String(vehicle.make || '').trim();
  const model = String(vehicle.model || vehicle.model_name || '').trim();
  if (!make || !model) return null;

  try {
    const { data } = await supabase
      .from('car_models')
      .select('id, make, model_name, variant, class')
      .eq('is_active', true)
      .ilike('make', `%${make.split(/\s+/)[0]}%`)
      .ilike('model_name', `%${model.split(/\s+/)[0]}%`)
      .order('model_name')
      .limit(1)
      .maybeSingle();
    return (data as CarModelOption) || null;
  } catch {
    return null;
  }
}

type ServiceTypeRow = { id: string; name: string; description?: string | null; category?: string };

async function fetchServiceTypesWithCategory(): Promise<ServiceTypeRow[]> {
  try {
    const { data: catRows } = await supabase.from('categories').select('uuid, category').order('category');
    const categoryMap: Record<string, string> = {};
    ((catRows as Array<{ uuid?: string; category?: string }>) || []).forEach((c) => {
      if (c.uuid && c.category) categoryMap[c.uuid] = c.category.toUpperCase();
    });

    const { data, error } = await supabase
      .from('service_types')
      .select('id,name,description,is_active,category_uuid')
      .eq('is_active', true)
      .order('name');
    if (error) throw error;

    return ((data as Array<{ id: string; name: string; description?: string | null; category_uuid?: string | null }>) || [])
      .filter((s) => s.id && s.name)
      .map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        category: s.category_uuid ? categoryMap[s.category_uuid] || 'OTHER SERVICES' : 'OTHER SERVICES',
      }));
  } catch {
    return [];
  }
}

export async function fetchCompareCategories(): Promise<CompareCategory[]> {
  const serviceTypes = await fetchServiceTypesWithCategory();
  const counts = new Map<string, number>();
  for (const svc of serviceTypes) {
    const key = normalizeCategoryKey(svc.category || '');
    if (!key || key === 'OTHER SERVICES') continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  const keys = Array.from(counts.keys());
  keys.sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a);
    const bi = CATEGORY_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  return keys.map((key) => {
    const ui = CATEGORY_UI[key] || DEFAULT_CATEGORY_UI;
    return {
      key,
      name: formatCategoryLabel(key),
      icon: ui.icon,
      color: ui.color,
      bg: ui.bg,
      serviceCount: counts.get(key) || 0,
    };
  });
}

function normalizeCategoryKey(raw: string): string {
  const upper = raw.toUpperCase();
  for (const key of CATEGORY_ORDER) {
    if (upper === key || upper.includes(key)) return key;
  }
  return upper.trim();
}

async function fetchServiceTypes(): Promise<ServiceTypeRow[]> {
  return fetchServiceTypesWithCategory();
}

function findServiceType(serviceTypes: ServiceTypeRow[], patterns: string[]): ServiceTypeRow | null {
  for (const pattern of patterns) {
    const hit = serviceTypes.find((s) => s.name.toLowerCase().includes(pattern));
    if (hit) return hit;
  }
  return null;
}

function buildQuoteFromServiceType(svc: ServiceTypeRow, basePrice: number): CompareQuote {
  const highlights = svc.description
    ? svc.description
        .split(/[•,\n|]/)
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 4)
    : ['Genuine parts', 'Expert technicians', 'Free pickup & drop'];

  if (basePrice <= 0) {
    const mid = 1999;
    const auth = authorisedPriceRange(mid);
    const myfng = myfngPriceRange(mid);
    return {
      id: svc.id,
      name: svc.name,
      checkpoints: 0,
      highlights,
      authorisedLow: auth.low,
      authorisedHigh: auth.high,
      myfngLow: myfng.low,
      myfngHigh: myfng.high,
      myfngBase: mid,
      discountLabel: savingsLabel(auth.low, myfng.high),
      serviceTypeId: svc.id,
      priceSource: 'indicative',
    };
  }

  const myfng = myfngPriceRange(basePrice);
  const auth = authorisedPriceRange(basePrice);
  return {
    id: svc.id,
    name: svc.name,
    checkpoints: 0,
    highlights,
    authorisedLow: auth.low,
    authorisedHigh: auth.high,
    myfngLow: myfng.low,
    myfngHigh: myfng.high,
    myfngBase: basePrice,
    discountLabel: savingsLabel(auth.low, myfng.high),
    serviceTypeId: svc.id,
    priceSource: 'live',
  };
}

function buildQuoteFromBase(
  def: (typeof PERIODIC_DEFS)[number] | { id: string; name: string; checkpoints: number; highlights: string[] },
  basePrice: number,
  serviceTypeId?: string,
  priceSource: 'live' | 'indicative' = 'live',
): CompareQuote {
  const myfng = basePrice > 0 ? myfngPriceRange(basePrice) : { low: 0, high: 0 };
  const auth = basePrice > 0 ? authorisedPriceRange(basePrice) : { low: 0, high: 0 };

  if (basePrice <= 0) {
    const fallback = PERIODIC_PACKAGES.find((p) => p.id === def.id) || PERIODIC_PACKAGES[0];
    return {
      id: def.id,
      name: def.name,
      checkpoints: def.checkpoints,
      highlights: def.highlights,
      authorisedLow: fallback.authorisedLow,
      authorisedHigh: fallback.authorisedHigh,
      myfngLow: fallback.myfngLow,
      myfngHigh: fallback.myfngHigh,
      myfngBase: Math.round((fallback.myfngLow + fallback.myfngHigh) / 2),
      discountLabel: fallback.discountLabel,
      serviceTypeId,
      priceSource: 'indicative',
    };
  }

  return {
    id: def.id,
    name: def.name,
    checkpoints: def.checkpoints,
    highlights: def.highlights,
    authorisedLow: auth.low,
    authorisedHigh: auth.high,
    myfngLow: myfng.low,
    myfngHigh: myfng.high,
    myfngBase: basePrice,
    discountLabel: savingsLabel(auth.low, myfng.high),
    serviceTypeId,
    priceSource,
  };
}

export async function fetchPeriodicCompareQuotes(
  city: CityRow,
  vehicleClass: string | null,
): Promise<CompareQuote[]> {
  const serviceTypes = await fetchServiceTypes();
  const quotes: CompareQuote[] = [];

  for (const def of PERIODIC_DEFS) {
    const svc = findServiceType(serviceTypes, [...def.patterns]);
    const staticPkg = PERIODIC_PACKAGES.find((p) => p.id === def.id);
    const name = staticPkg?.name || def.id;

    if (!svc) {
      quotes.push(
        buildQuoteFromBase(
          { id: def.id, name, checkpoints: def.checkpoints, highlights: [...def.highlights] },
          0,
          undefined,
          'indicative',
        ),
      );
      continue;
    }

    const base = await fetchServicePriceForBooking(svc.id, city.id, city.zone_id || null, vehicleClass);
    quotes.push(
      buildQuoteFromBase(
        { id: def.id, name, checkpoints: def.checkpoints, highlights: [...def.highlights] },
        base,
        svc.id,
        base > 0 ? 'live' : 'indicative',
      ),
    );
  }

  return quotes;
}

export async function fetchCategoryCompareQuotes(
  categoryKey: string,
  city: CityRow,
  vehicleClass: string | null,
): Promise<CompareQuote[]> {
  const key = normalizeCategoryKey(categoryKey);
  if (key === 'PERIODIC') {
    return fetchPeriodicCompareQuotes(city, vehicleClass);
  }

  const serviceTypes = await fetchServiceTypesWithCategory();
  const matched = serviceTypes.filter((svc) => normalizeCategoryKey(svc.category || '') === key);
  if (matched.length === 0) return [];

  const quotes = await Promise.all(
    matched.map(async (svc) => {
      const base = await fetchServicePriceForBooking(svc.id, city.id, city.zone_id || null, vehicleClass);
      return buildQuoteFromServiceType(svc, base);
    }),
  );

  return quotes.sort((a, b) => a.myfngLow - b.myfngLow);
}

/** @deprecated use fetchCategoryCompareQuotes */
export async function fetchOtherServiceQuote(
  categoryId: string,
  city: CityRow,
  vehicleClass: string | null,
): Promise<CompareQuote | null> {
  const rows = await fetchCategoryCompareQuotes(categoryId, city, vehicleClass);
  return rows[0] || null;
}

export function formatQuoteRange(low: number, high: number): string {
  if (!low && !high) return 'Price on request';
  if (low === high) return formatInrRange(low, high).replace(' – ', '');
  return formatInrRange(low, high);
}

export function selectedCarLabel(car: SelectedCar | null): string {
  if (!car) return 'Select your car';
  return car.label;
}
