export const CAR_IMAGE_BASE_URL =
  'https://cffommijlvicfjhbqyzk.supabase.co/storage/v1/object/public/App/car-brands-images';

/**
 * DB make values that differ from Supabase storage folder / brand logo names.
 * Audit: only maruti + mercedes mismatch among brands with uploaded images.
 */
const MAKE_STORAGE_ALIASES: Record<string, string> = {
  maruti: 'maruti-suzuki',
  mercedes: 'mercedes-benz',
};

export function slugifyVehiclePart(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');
}

export function resolveStorageMakeSlugs(rawMake: string): string[] {
  const slug = slugifyVehiclePart(rawMake);
  if (!slug) return [];

  const slugs = new Set<string>([slug]);
  const alias = MAKE_STORAGE_ALIASES[slug];
  if (alias) slugs.add(alias);

  const first = slug.split('-')[0];
  const firstAlias = MAKE_STORAGE_ALIASES[first];
  if (firstAlias) slugs.add(firstAlias);

  return Array.from(slugs);
}

/** Generate filename slug variants to match storage naming quirks. */
export function getModelSlugCandidates(rawModel: string): string[] {
  const slug = slugifyVehiclePart(rawModel);
  if (!slug) return [];

  const slugs = new Set<string>([slug]);
  slugs.add(slug.replace(/-/g, ''));
  slugs.add(slug.replace(/[()]/g, ''));

  const parts = slug.split('-').filter(Boolean);
  if (parts.length > 1) {
    slugs.add(parts[parts.length - 1]);
    slugs.add(parts.slice(-2).join('-'));
  }

  // Toyota Innova / Urban Cruiser sub-models in storage filenames.
  slugs.add(`innova-${slug}`);
  slugs.add(`urban-cruiser-${slug}`);

  // Mahindra Classic is stored as Scorpio Classic.
  if (slug === 'classic') slugs.add('scorpio-classic');

  return Array.from(slugs);
}

/** Ordered image URLs to try (model image → brand logo → default). */
export function getVehicleImageCandidates(make?: string, model?: string): string[] {
  const makeSlugs = resolveStorageMakeSlugs(make || '');
  const modelSlugs = getModelSlugCandidates(model || '');
  const candidates: string[] = [];

  if (modelSlugs.length && makeSlugs.length) {
    for (const makeSlug of makeSlugs) {
      const makePart = makeSlug.split('-')[0];
      for (const modelSlug of modelSlugs) {
        candidates.push(`${CAR_IMAGE_BASE_URL}/${makeSlug}-cars/${makePart}-${modelSlug}.png`);
      }
    }
  }

  for (const makeSlug of makeSlugs) {
    candidates.push(`${CAR_IMAGE_BASE_URL}/${makeSlug}.png`);
  }

  candidates.push(`${CAR_IMAGE_BASE_URL}/default-car.png`);
  return [...new Set(candidates)];
}

export function getVehicleImageUris(vehicle: any): { primary: string; fallback: string; candidates: string[] } {
  const rawMake = String(vehicle?.make || vehicle?.vehicle_make || '').trim();
  const rawModel = String(vehicle?.model || vehicle?.model_name || vehicle?.vehicle_model || '').trim();
  const candidates = getVehicleImageCandidates(rawMake, rawModel);
  return {
    primary: candidates[0] || `${CAR_IMAGE_BASE_URL}/default-car.png`,
    fallback:
      candidates.find((url) => url.endsWith('.png') && !url.includes('-cars/')) ||
      `${CAR_IMAGE_BASE_URL}/default-car.png`,
    candidates,
  };
}
