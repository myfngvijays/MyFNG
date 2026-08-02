export const VEHICLE_IMAGE_BUCKET = 'App';
export const VEHICLE_IMAGE_PREFIX = 'car-brands-images';

export function getVehicleImagePublicBase(): string {
  return '/media/App/car-brands-images';
}

export function slugifyVehiclePart(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');
}

/** Maps common DB / user make values to Supabase storage folder names. */
const MAKE_STORAGE_ALIASES: Record<string, string> = {
  maruti: 'maruti-suzuki',
  mercedes: 'mercedes-benz',
};

export function resolveStorageMakeSlug(rawMake: string): string {
  const slug = slugifyVehiclePart(rawMake);
  if (!slug) return slug;
  return MAKE_STORAGE_ALIASES[slug] || MAKE_STORAGE_ALIASES[slug.split('-')[0]] || slug;
}

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

  slugs.add(`innova-${slug}`);
  slugs.add(`urban-cruiser-${slug}`);
  if (slug === 'classic') slugs.add('scorpio-classic');

  return Array.from(slugs);
}

/** Matches mobile app vehicle image path convention. */
export function buildModelImagePath(make: string, model: string): string {
  const makeSlug = resolveStorageMakeSlug(make);
  const modelSlug = getModelSlugCandidates(model)[0] || slugifyVehiclePart(model);
  const makePart = makeSlug.split('-')[0];
  const folderName = `${makeSlug}-cars`;
  const fileName = `${makePart}-${modelSlug}.png`;
  return `${VEHICLE_IMAGE_PREFIX}/${folderName}/${fileName}`;
}

export function buildBrandImagePath(make: string): string {
  const makeSlug = resolveStorageMakeSlug(make);
  return `${VEHICLE_IMAGE_PREFIX}/${makeSlug}.png`;
}

export function getPublicUrlForStoragePath(storagePath: string): string {
  const encoded = storagePath
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
  return `/media/${VEHICLE_IMAGE_BUCKET}/${encoded}`;
}

export function getVehicleImageCandidates(
  make?: string,
  model?: string,
  extraModelSlugs?: string[],
): string[] {
  const makeSlug = resolveStorageMakeSlug(make || '');
  const modelSlugs = new Set<string>();

  for (const slug of extraModelSlugs || []) {
    if (slug) modelSlugs.add(slug);
  }
  for (const slug of getModelSlugCandidates(model || '')) {
    modelSlugs.add(slug);
  }

  const candidates: string[] = [];

  if (modelSlugs.size && makeSlug) {
    const makePart = makeSlug.split('-')[0];
    for (const modelSlug of modelSlugs) {
      candidates.push(
        getPublicUrlForStoragePath(`${VEHICLE_IMAGE_PREFIX}/${makeSlug}-cars/${makePart}-${modelSlug}.png`),
      );
    }
  }

  if (makeSlug) {
    candidates.push(getPublicUrlForStoragePath(`${VEHICLE_IMAGE_PREFIX}/${makeSlug}.png`));
  }

  candidates.push(getPublicUrlForStoragePath(`${VEHICLE_IMAGE_PREFIX}/default-car.png`));
  return [...new Set(candidates)];
}

export function getVehicleImageUrl(make?: string, model?: string): string {
  return getVehicleImageCandidates(make, model)[0];
}

export function parseModelImagePath(storagePath: string): { makeSlug: string; modelSlug: string } | null {
  const normalized = storagePath.replace(/^car-brands-images\//, '');
  const match = normalized.match(/^(.+)-cars\/([^/]+)-(.+)\.png$/i);
  if (!match) return null;
  return { makeSlug: match[1], modelSlug: match[3] };
}

export function formatLabelFromSlug(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export type VehicleImageRow = {
  id: string;
  type: 'model' | 'brand' | 'default';
  make: string;
  model: string | null;
  make_slug: string;
  model_slug: string | null;
  storage_path: string;
  image_url: string;
  updated_at: string | null;
};
