const UTM_STORAGE_KEY = 'myfng:utm_params';

const UTM_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
] as const;

type UtmKey = (typeof UTM_KEYS)[number];

export type UtmParams = Partial<Record<UtmKey, string>>;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function parseUtmParams(search: string): UtmParams {
  const params = new URLSearchParams(search || '');
  const result: UtmParams = {};

  UTM_KEYS.forEach((key) => {
    const value = params.get(key);
    if (isNonEmptyString(value)) {
      result[key] = value.trim();
    }
  });

  return result;
}

export function getStoredUtmParams(): UtmParams {
  if (typeof window === 'undefined') return {};

  try {
    const raw = window.sessionStorage.getItem(UTM_STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const normalized: UtmParams = {};

    UTM_KEYS.forEach((key) => {
      const value = parsed?.[key];
      if (isNonEmptyString(value)) {
        normalized[key] = value.trim();
      }
    });

    return normalized;
  } catch {
    return {};
  }
}

export function setStoredUtmParams(utm: UtmParams): void {
  if (typeof window === 'undefined') return;

  try {
    const hasAtLeastOneValue = UTM_KEYS.some((key) => isNonEmptyString(utm[key]));
    if (!hasAtLeastOneValue) return;

    window.sessionStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(utm));
  } catch {
    // Ignore session storage failures silently.
  }
}

export function captureUtmParamsFromUrl(search?: string): UtmParams {
  const currentSearch =
    typeof search === 'string'
      ? search
      : (typeof window !== 'undefined' ? window.location.search : '');

  const fromUrl = parseUtmParams(currentSearch);
  const fromStorage = getStoredUtmParams();
  const merged: UtmParams = { ...fromStorage, ...fromUrl };

  setStoredUtmParams(merged);
  return merged;
}

export function getCurrentOrStoredUtmParams(search?: string): UtmParams {
  const currentSearch =
    typeof search === 'string'
      ? search
      : (typeof window !== 'undefined' ? window.location.search : '');

  const fromUrl = parseUtmParams(currentSearch);
  if (Object.keys(fromUrl).length > 0) {
    const merged = { ...getStoredUtmParams(), ...fromUrl };
    setStoredUtmParams(merged);
    return merged;
  }

  return getStoredUtmParams();
}

export function getLeadSourceFromUtm(utmSource?: string | null, utmMedium?: string | null): string {
  const source = String(utmSource || '').toLowerCase();
  const medium = String(utmMedium || '').toLowerCase();

  if (
    source.includes('google') ||
    source.includes('adwords') ||
    source.includes('gads') ||
    medium.includes('cpc') ||
    medium.includes('ppc')
  ) {
    return 'Google Ads';
  }

  if (
    source.includes('instagram') ||
    source.includes('insta') ||
    source.includes('meta') ||
    source.includes('facebook') ||
    source.includes('fb')
  ) {
    return 'Instagram Ads';
  }

  if (source.includes('whatsapp')) return 'WhatsApp';
  if (source.includes('partner')) return 'Partner';
  if (source.includes('app')) return 'App Booking';
  if (source.includes('reference') || source.includes('referral')) return 'Reference';
  if (medium.includes('offline') || medium.includes('banner')) return 'Banner/Offline';

  return 'Website';
}
