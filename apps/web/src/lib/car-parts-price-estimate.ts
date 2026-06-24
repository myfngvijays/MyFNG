import { searchBoodmoPartPrice } from './parts-price/boodmo-client';
import { searchBoodmoViaGoogle, searchGooglePartPrice } from './parts-price/google-parts-search';
import { mergePriceRanges } from './parts-price/parse-inr-prices';

export type CarPartsEstimateInput = {
  make: string;
  model: string;
  regYear?: number;
  fuel?: string;
  variant?: string;
  vehicleClass?: string | null;
  city?: string | null;
};

export type CarPartEstimateRow = {
  name: string;
  low: number;
  high: number;
  note?: string;
};

export type CarPartsCategoryEstimate = {
  id: string;
  name: string;
  icon: string;
  parts: CarPartEstimateRow[];
};

export type CarPartsEstimateSource =
  | 'boodmo_google'
  | 'boodmo'
  | 'google'
  | 'catalog_fallback';

export type CarPartsEstimateResult = {
  source: CarPartsEstimateSource;
  vehicle_summary: string;
  categories: CarPartsCategoryEstimate[];
  disclaimer: string;
};

const BASE_CATALOG: CarPartsCategoryEstimate[] = [
  {
    id: 'service',
    name: 'Service Consumables',
    icon: 'water',
    parts: [
      { name: 'Engine Oil + Filter', low: 1800, high: 4500 },
      { name: 'Air Filter', low: 450, high: 1800 },
      { name: 'Cabin AC Filter', low: 600, high: 2200 },
      { name: 'Spark Plugs (set)', low: 800, high: 3500 },
    ],
  },
  {
    id: 'brakes',
    name: 'Brakes',
    icon: 'disc',
    parts: [
      { name: 'Front Brake Pads', low: 2200, high: 6500 },
      { name: 'Rear Brake Pads', low: 1800, high: 5200 },
      { name: 'Brake Disc (each)', low: 2500, high: 8000 },
      { name: 'Brake Fluid Top-up', low: 400, high: 1200 },
    ],
  },
  {
    id: 'electrical',
    name: 'Electrical',
    icon: 'flash',
    parts: [
      { name: 'Car Battery 45Ah', low: 3500, high: 7500 },
      { name: 'Alternator', low: 6500, high: 18000 },
      { name: 'Headlight Assembly', low: 2500, high: 12000 },
      { name: 'Starter Motor', low: 4500, high: 14000 },
    ],
  },
  {
    id: 'suspension',
    name: 'Suspension',
    icon: 'car-sport',
    parts: [
      { name: 'Shock Absorber (each)', low: 2800, high: 8500 },
      { name: 'Lower Arm', low: 2200, high: 6500 },
      { name: 'Wheel Bearing', low: 1800, high: 5500 },
    ],
  },
  {
    id: 'ac',
    name: 'AC & Cooling',
    icon: 'snow',
    parts: [
      { name: 'AC Compressor', low: 12000, high: 28000 },
      { name: 'Radiator', low: 3500, high: 9000 },
      { name: 'Coolant Refill', low: 500, high: 1500 },
    ],
  },
  {
    id: 'tyres',
    name: 'Tyres & Wheels',
    icon: 'ellipse-outline',
    parts: [
      { name: 'Tyre (each)', low: 3500, high: 12000 },
      { name: 'Wheel Alignment', low: 600, high: 1500 },
      { name: 'Wheel Balancing (4)', low: 400, high: 1000 },
    ],
  },
];

function brandMultiplier(make: string): number {
  const b = make.toLowerCase();
  if (['bmw', 'mercedes', 'audi', 'volvo', 'jaguar', 'land rover', 'porsche'].some((x) => b.includes(x))) {
    return 1.55;
  }
  if (['toyota', 'honda', 'skoda', 'volkswagen', 'jeep'].some((x) => b.includes(x))) return 1.12;
  if (['maruti', 'suzuki', 'hyundai', 'tata', 'mahindra', 'kia'].some((x) => b.includes(x))) return 1;
  return 1.05;
}

function vehicleClassMultiplier(vehicleClass?: string | null): number {
  const c = String(vehicleClass || '').toLowerCase();
  if (c.includes('luxury') || c.includes('premium')) return 1.2;
  if (c.includes('compact') || c.includes('hatch')) return 0.92;
  if (c.includes('suv') || c.includes('muv')) return 1.08;
  return 1;
}

function ageMultiplier(regYear?: number): number {
  if (!regYear || regYear < 1990) return 1;
  const age = new Date().getFullYear() - regYear;
  if (age <= 3) return 1.08;
  if (age <= 7) return 1;
  if (age <= 12) return 0.95;
  return 0.88;
}

function fuelMultiplier(fuel?: string): number {
  const f = String(fuel || '').toLowerCase();
  if (f.includes('diesel')) return 1.06;
  if (f.includes('ev') || f.includes('electric')) return 1.15;
  if (f.includes('cng')) return 0.98;
  return 1;
}

function scalePart(row: CarPartEstimateRow, factor: number): CarPartEstimateRow {
  const low = Math.max(100, Math.round(row.low * factor));
  const high = Math.max(low + 50, Math.round(row.high * factor));
  return { ...row, low, high };
}

export function buildCatalogFallbackEstimate(input: CarPartsEstimateInput): CarPartsEstimateResult {
  const factor =
    brandMultiplier(input.make) *
    vehicleClassMultiplier(input.vehicleClass) *
    ageMultiplier(input.regYear) *
    fuelMultiplier(input.fuel);

  const categories = BASE_CATALOG.map((cat) => ({
    ...cat,
    parts: cat.parts.map((p) => scalePart(p, factor)),
  }));

  const cityBit = input.city ? ` · ${input.city}` : '';
  const yearBit = input.regYear ? ` · ${input.regYear}` : '';
  const fuelBit = input.fuel ? ` · ${input.fuel}` : '';

  return {
    source: 'catalog_fallback',
    vehicle_summary: `${input.make} ${input.model}${yearBit}${fuelBit}${cityBit}`.trim(),
    categories,
    disclaimer:
      'Indicative genuine/OEM parts price ranges for India. Live Boodmo/Google prices were unavailable — showing catalog estimate. Final price varies by variant, part brand, city and workshop. Labour extra.',
  };
}

async function lookupCategoryPrices(
  input: CarPartsEstimateInput,
  category: CarPartsCategoryEstimate,
  factor: number,
): Promise<{
  parts: CarPartEstimateRow[];
  fromBoodmo: boolean;
  fromGoogle: boolean;
}> {
  const partNames = category.parts.map((p) => p.name);
  const searchPhrase = partNames.slice(0, 2).join(' ');
  const [boodmoDirect, boodmoGoogle, google] = await Promise.all([
    searchBoodmoPartPrice({ make: input.make, model: input.model, partName: searchPhrase }),
    searchBoodmoViaGoogle({ make: input.make, model: input.model, partName: searchPhrase }),
    searchGooglePartPrice({
      make: input.make,
      model: input.model,
      partName: `${category.name} ${searchPhrase}`,
      city: input.city,
    }),
  ]);

  const categoryRange = mergePriceRanges([boodmoDirect.range, boodmoGoogle.range, google.range]);
  const fromBoodmo = Boolean(boodmoDirect.range || boodmoGoogle.range);
  const fromGoogle = Boolean(google.range);

  const parts = category.parts.map((part) => {
    const fallback = scalePart(part, factor);
    if (!categoryRange) {
      return {
        ...part,
        low: fallback.low,
        high: fallback.high,
        note: 'Catalog estimate · live price not found on Boodmo/Google',
      };
    }

    const partKey = part.name.toLowerCase();
    const anchor = categoryRange.low;
    const spread = Math.max(categoryRange.high - categoryRange.low, Math.round(anchor * 0.12));
    const low = Math.max(100, Math.round(anchor + spread * 0.05));
    const high = Math.max(low + 50, Math.round(categoryRange.high + spread * 0.08));

    const notes: string[] = [];
    if (fromBoodmo) notes.push('Boodmo');
    if (fromGoogle) notes.push('Google');

    return {
      name: part.name,
      low: partKey.includes('top-up') || partKey.includes('alignment') || partKey.includes('balancing')
        ? fallback.low
        : low,
      high: partKey.includes('top-up') || partKey.includes('alignment') || partKey.includes('balancing')
        ? fallback.high
        : high,
      note: `Live ${category.name.toLowerCase()} estimate from ${notes.join(' + ')} · labour extra`,
    };
  });

  return { parts, fromBoodmo, fromGoogle };
}

async function buildWebSourcedEstimate(input: CarPartsEstimateInput): Promise<CarPartsEstimateResult | null> {
  const factor =
    brandMultiplier(input.make) *
    vehicleClassMultiplier(input.vehicleClass) *
    ageMultiplier(input.regYear) *
    fuelMultiplier(input.fuel);

  let anyLive = false;
  let anyBoodmo = false;
  let anyGoogle = false;

  const categories: CarPartsCategoryEstimate[] = [];

  for (const cat of BASE_CATALOG) {
    const result = await lookupCategoryPrices(input, cat, factor);
    if (result.fromBoodmo || result.fromGoogle) {
      anyLive = true;
      if (result.fromBoodmo) anyBoodmo = true;
      if (result.fromGoogle) anyGoogle = true;
    }
    categories.push({ ...cat, parts: result.parts });
  }

  if (!anyLive) return null;

  const cityBit = input.city ? ` · ${input.city}` : '';
  const yearBit = input.regYear ? ` · ${input.regYear}` : '';
  const fuelBit = input.fuel ? ` · ${input.fuel}` : '';

  let source: CarPartsEstimateSource = 'google';
  if (anyBoodmo && anyGoogle) source = 'boodmo_google';
  else if (anyBoodmo) source = 'boodmo';

  return {
    source,
    vehicle_summary: `${input.make} ${input.model}${yearBit}${fuelBit}${cityBit}`.trim(),
    categories,
    disclaimer:
      'Prices are indicative ranges pulled from Boodmo.com listings and Google search results for your car in India. Verify exact part number, brand (OEM/OES/aftermarket) and availability before purchase. Labour charges are extra.',
  };
}

export async function estimateCarPartsPrices(input: CarPartsEstimateInput): Promise<CarPartsEstimateResult> {
  const normalized: CarPartsEstimateInput = {
    make: String(input.make || '').trim(),
    model: String(input.model || '').trim(),
    regYear: input.regYear ? Number(input.regYear) : undefined,
    fuel: input.fuel ? String(input.fuel).trim() : undefined,
    variant: input.variant ? String(input.variant).trim() : undefined,
    vehicleClass: input.vehicleClass || null,
    city: input.city ? String(input.city).trim() : null,
  };

  if (!normalized.make || !normalized.model) {
    throw new Error('Make and model are required');
  }

  try {
    const web = await buildWebSourcedEstimate(normalized);
    if (web) return web;
  } catch (err) {
    console.error('[car-parts-price-estimate] web lookup error:', err);
  }

  return buildCatalogFallbackEstimate(normalized);
}
