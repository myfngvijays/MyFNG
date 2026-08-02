import { createClient } from '@/lib/supabase/server';
import { getVehicleImageCandidates } from '@/lib/vehicleImages';
import type { PopularBrandPageConfig } from '@/lib/popular-brands';

export type BrandModelCard = {
  id: string;
  make: string;
  modelName: string;
  displayName: string;
  fullDisplayName: string;
  imageUrl: string;
  imageCandidates: string[];
  bookUrl: string;
};

const DISPLAY_DB_ALIASES: Record<string, string[]> = {
  Brezza: ['vitara brezza', 'brezza'],
  Ignis: ['ignis'],
  Alto: ['alto', 'alto k10'],
  'Wagon R': ['wagon r', 'wagonr'],
  'S-Presso': ['s presso', 'spresso'],
  'Grand Vitara': ['grand vitara'],
  i20: ['i20', 'i 20'],
  'Innova Crysta': ['innova crysta', 'innova'],
  'Urban Cruiser Hyryder': ['hyryder', 'urban cruiser hyryder'],
  'Scorpio-N': ['scorpio n', 'scorpio-n', 'scorpio n z8'],
  XUV700: ['xuv700', 'xuv 700'],
  XUV300: ['xuv300', 'xuv 300'],
  XUV400: ['xuv400', 'xuv 400'],
  'WR-V': ['wr-v', 'wrv', 'wr v'],
};

const DISPLAY_IMAGE_SLUGS: Record<string, string[]> = {
  Brezza: ['brezza', 'vitara-brezza'],
  Ignis: ['ignis'],
  Alto: ['alto-k10', 'alto'],
  'Wagon R': ['wagon-r', 'wagonr'],
  'S-Presso': ['s-presso', 'spresso'],
  'Grand Vitara': ['grand-vitara'],
  i20: ['i20'],
  Creta: ['creta'],
  Verna: ['verna'],
  Venue: ['venue'],
  Nexon: ['nexon'],
  Punch: ['punch'],
  Harrier: ['harrier'],
  Safari: ['safari'],
  Thar: ['thar'],
  XUV700: ['xuv700'],
  Scorpio: ['scorpio'],
  City: ['city'],
  Amaze: ['amaze'],
  Elevate: ['elevate'],
  Seltos: ['seltos'],
  Sonet: ['sonet'],
  Carens: ['carens'],
  Slavia: ['slavia'],
  Kushaq: ['kushaq'],
  Virtus: ['virtus'],
  Taigun: ['taigun'],
  Polo: ['polo'],
  'Innova Crysta': ['innova-crysta', 'innova'],
  Fortuner: ['fortuner'],
};

function fullBrandModelName(brandName: string, model: string): string {
  return `${brandName} ${model}`.replace(/\s+/g, ' ').trim();
}

function normalizeModelName(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function matchModelRow(rows: Array<{ id: string; make: string; model_name: string }>, displayName: string) {
  const aliases = DISPLAY_DB_ALIASES[displayName] || [displayName];
  for (const alias of aliases) {
    const wanted = normalizeModelName(alias);
    const match =
      rows.find((row) => normalizeModelName(row.model_name) === wanted) ||
      rows.find((row) => normalizeModelName(row.model_name).includes(wanted)) ||
      rows.find((row) => wanted.includes(normalizeModelName(row.model_name)));
    if (match) return match;
  }
  return undefined;
}

function buildMakeFilter(patterns: string[]): string {
  return patterns.map((pattern) => `make.ilike.%${pattern}%`).join(',');
}

function buildFallbackCards(brand: PopularBrandPageConfig): BrandModelCard[] {
  return brand.models.map((model) => {
    const imageCandidates = getVehicleImageCandidates(
      brand.prefillMake,
      model,
      DISPLAY_IMAGE_SLUGS[model],
    );
    return {
      id: model,
      make: brand.prefillMake,
      modelName: model,
      displayName: model,
      fullDisplayName: fullBrandModelName(brand.name, model),
      imageUrl: imageCandidates[0],
      imageCandidates,
      bookUrl: `/book-service?prefill_make=${encodeURIComponent(brand.prefillMake)}&prefill_model=${encodeURIComponent(model)}`,
    };
  });
}

export async function fetchBrandModelCards(brand: PopularBrandPageConfig): Promise<BrandModelCard[]> {
  const supabase = await createClient();
  const makeFilter = buildMakeFilter(brand.dbMakePatterns);
  const { data, error } = await supabase
    .from('car_models')
    .select('id, make, model_name')
    .eq('is_active', true)
    .or(makeFilter)
    .order('model_name');

  if (error || !data?.length) {
    return buildFallbackCards(brand);
  }

  return brand.models.map((displayName) => {
    const row = matchModelRow(data, displayName);
    const make = row?.make || brand.prefillMake;
    const modelName = row?.model_name || displayName;
    const imageCandidates = getVehicleImageCandidates(make, modelName, DISPLAY_IMAGE_SLUGS[displayName]);
    const params = new URLSearchParams({
      prefill_make: make,
      prefill_model: modelName,
    });
    if (row?.id) params.set('prefill_car_id', row.id);

    return {
      id: row?.id || displayName,
      make,
      modelName,
      displayName,
      fullDisplayName: fullBrandModelName(brand.name, displayName),
      imageUrl: imageCandidates[0],
      imageCandidates,
      bookUrl: `/book-service?${params.toString()}`,
    };
  });
}
