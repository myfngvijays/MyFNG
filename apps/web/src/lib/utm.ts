const UTM_STORAGE_KEY = 'myfng:utm_params';
export const UTM_COOKIE_KEY = 'myfng_utm';
const UTM_LOCAL_STORAGE_KEY = 'myfng:utm_params_ls';
const UTM_COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30 days

export const UTM_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
] as const;

type UtmKey = (typeof UTM_KEYS)[number];

export type UtmParams = Partial<Record<UtmKey, string>>;

export const UTM_DISPLAY_LABELS: Record<UtmKey, string> = {
  utm_source: 'UTM Source',
  utm_medium: 'UTM Medium',
  utm_campaign: 'UTM Campaign',
  utm_term: 'UTM Term',
  utm_content: 'UTM Content',
};

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

export function normalizeUtmParams(raw: unknown): UtmParams {
  if (!raw || typeof raw !== 'object') return {};
  const result: UtmParams = {};
  UTM_KEYS.forEach((key) => {
    const value = (raw as Record<string, unknown>)[key];
    if (isNonEmptyString(value)) result[key] = value.trim();
  });
  return result;
}

export function mergeUtmParams(...sources: unknown[]): UtmParams {
  let merged: UtmParams = {};
  for (const source of sources) {
    merged = { ...merged, ...normalizeUtmParams(source) };
  }
  return merged;
}

const TELECRM_LABEL_TO_UTM: Record<string, UtmKey> = {
  'UTM Source': 'utm_source',
  'UTM Medium': 'utm_medium',
  'UTM Campaign': 'utm_campaign',
  'UTM Term': 'utm_term',
  'UTM Content': 'utm_content',
};

/** Pull utm_* from lead rows, meta blobs, nested utm objects, or TeleCRM labels. */
export function extractUtmFromUnknown(raw: unknown): UtmParams {
  if (!raw || typeof raw !== 'object') return {};

  const obj = raw as Record<string, unknown>;
  let merged = mergeUtmParams(
    obj,
    obj.meta,
    obj.meta && typeof obj.meta === 'object'
      ? (obj.meta as Record<string, unknown>).tracking
      : undefined,
    obj.utm,
    obj.utmParams,
    obj.tracking_utm,
    obj.trackingUtm,
    obj.tracking,
  );

  for (const [label, key] of Object.entries(TELECRM_LABEL_TO_UTM)) {
    const direct = obj[label];
    const fromMeta =
      obj.meta && typeof obj.meta === 'object'
        ? (obj.meta as Record<string, unknown>)[label]
        : undefined;
    const value = isNonEmptyString(direct) ? direct : isNonEmptyString(fromMeta) ? fromMeta : null;
    if (value) merged[key] = value.trim();
  }

  return merged;
}

export function parseUtmCookie(cookieValue: string | null | undefined): UtmParams {
  if (!cookieValue) return {};
  try {
    return normalizeUtmParams(JSON.parse(decodeURIComponent(cookieValue)));
  } catch {
    return parseUtmParams(cookieValue.startsWith('?') ? cookieValue : `?${cookieValue}`);
  }
}

function writeUtmCookie(utm: UtmParams): void {
  if (typeof document === 'undefined') return;
  try {
    const encoded = encodeURIComponent(JSON.stringify(utm));
    document.cookie = `${UTM_COOKIE_KEY}=${encoded}; Path=/; Max-Age=${UTM_COOKIE_MAX_AGE_SEC}; SameSite=Lax`;
  } catch {
    // ignore cookie failures
  }
}

function readUtmCookie(): UtmParams {
  if (typeof document === 'undefined') return {};
  try {
    const match = document.cookie.match(new RegExp(`(?:^|; )${UTM_COOKIE_KEY}=([^;]*)`));
    if (!match?.[1]) return {};
    return parseUtmCookie(decodeURIComponent(match[1]));
  } catch {
    return {};
  }
}

export function parseUtmFromRequest(
  request: { cookies?: { get?: (name: string) => { value?: string } | undefined }; headers?: { get?: (name: string) => string | null } },
): UtmParams {
  const fromCookie = parseUtmCookie(request.cookies?.get?.(UTM_COOKIE_KEY)?.value);
  const referer = request.headers?.get?.('referer') || '';
  let fromReferer: UtmParams = {};
  if (referer) {
    try {
      fromReferer = parseUtmParams(new URL(referer).search);
    } catch {
      fromReferer = {};
    }
  }
  return mergeUtmParams(fromCookie, fromReferer);
}

export function getStoredUtmParams(): UtmParams {
  if (typeof window === 'undefined') return {};

  try {
    const raw = window.sessionStorage.getItem(UTM_STORAGE_KEY);
    if (raw) {
      const parsed = normalizeUtmParams(JSON.parse(raw));
      if (Object.keys(parsed).length > 0) return parsed;
    }
  } catch {
    // fall through
  }

  try {
    const raw = window.localStorage.getItem(UTM_LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = normalizeUtmParams(JSON.parse(raw));
      if (Object.keys(parsed).length > 0) return parsed;
    }
  } catch {
    // fall through
  }

  return readUtmCookie();
}

export function setStoredUtmParams(utm: UtmParams): void {
  if (typeof window === 'undefined') return;

  try {
    const hasAtLeastOneValue = UTM_KEYS.some((key) => isNonEmptyString(utm[key]));
    if (!hasAtLeastOneValue) return;

    const serialized = JSON.stringify(utm);
    window.sessionStorage.setItem(UTM_STORAGE_KEY, serialized);
    window.localStorage.setItem(UTM_LOCAL_STORAGE_KEY, serialized);
    writeUtmCookie(utm);
  } catch {
    // Ignore storage failures silently.
  }
}

export function captureUtmParamsFromUrl(search?: string): UtmParams {
  const currentSearch =
    typeof search === 'string'
      ? search
      : typeof window !== 'undefined'
        ? window.location.search
        : '';

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
      : typeof window !== 'undefined'
        ? window.location.search
        : '';

  const fromUrl = parseUtmParams(currentSearch);
  if (Object.keys(fromUrl).length > 0) {
    const merged = { ...getStoredUtmParams(), ...fromUrl };
    setStoredUtmParams(merged);
    return merged;
  }

  return getStoredUtmParams();
}

/** Alias for lead/booking payloads — all 5 standard UTM fields. */
export function getLeadTrackingMeta(search?: string): UtmParams {
  return getCurrentOrStoredUtmParams(search);
}

export function hasStoredUtmParams(): boolean {
  return UTM_KEYS.some((key) => isNonEmptyString(getStoredUtmParams()[key]));
}

export function isInternalHref(href: string): boolean {
  const value = String(href || '').trim();
  if (!value || value.startsWith('#') || value.startsWith('mailto:') || value.startsWith('tel:')) {
    return false;
  }
  if (value.startsWith('javascript:')) return false;

  if (typeof window === 'undefined') {
    return value.startsWith('/');
  }

  try {
    const url = new URL(value, window.location.origin);
    return url.origin === window.location.origin;
  } catch {
    return value.startsWith('/');
  }
}

export function appendUtmToHref(href: string, utm: UtmParams = getStoredUtmParams()): string {
  const keys = Object.keys(utm) as UtmKey[];
  if (keys.length === 0) return href;

  try {
    const url = new URL(href, typeof window !== 'undefined' ? window.location.origin : 'https://myfng.in');
    keys.forEach((key) => {
      const value = utm[key];
      if (value && !url.searchParams.has(key)) {
        url.searchParams.set(key, value);
      }
    });

    if (typeof window !== 'undefined' && url.origin === window.location.origin) {
      return url.pathname + url.search + url.hash;
    }
    return url.toString();
  } catch {
    return href;
  }
}

export function appendUtmToPath(path: string): string {
  return appendUtmToHref(path);
}

export function decorateInternalLinks(root: ParentNode = document): void {
  const utm = getStoredUtmParams();
  if (Object.keys(utm).length === 0) return;

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://myfng.in';

  root.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((a) => {
    const href = a.getAttribute('href');
    if (!href || !isInternalHref(href)) return;

    try {
      const updated = appendUtmToHref(href, utm);
      if (updated !== href) a.setAttribute('href', updated);
    } catch {
      // skip malformed hrefs
    }
  });

  root.querySelectorAll<HTMLElement>('[data-track-href]').forEach((el) => {
    const href = el.getAttribute('data-track-href');
    if (!href || !isInternalHref(href)) return;
    try {
      const updated = appendUtmToHref(href, utm);
      if (updated !== href) el.setAttribute('data-track-href', updated);
    } catch {
      // skip
    }
  });

  root.querySelectorAll<HTMLFormElement>('form[action]').forEach((form) => {
    const action = form.getAttribute('action');
    if (!action || !isInternalHref(action)) return;
    try {
      const updated = appendUtmToHref(action, utm);
      if (updated !== action) form.setAttribute('action', updated);
    } catch {
      // skip
    }
  });
}

let utmPassthroughInstalled = false;

/** Keeps utm_* on link clicks without patching browser APIs (breaks Next.js dev perf). */
export function installUtmPassthrough(): void {
  if (typeof window === 'undefined' || utmPassthroughInstalled) return;
  utmPassthroughInstalled = true;

  document.addEventListener(
    'click',
    (event) => {
      if (event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target as Element | null;
      if (!target) return;

      const anchor = target.closest('a[href]') as HTMLAnchorElement | null;
      if (anchor) {
        const href = anchor.getAttribute('href');
        if (!href || href.startsWith('#') || anchor.target === '_blank' || !isInternalHref(href)) return;
        const updated = appendUtmToHref(href);
        if (updated !== href) anchor.setAttribute('href', updated);
        return;
      }

      const tracked = target.closest('[data-track-href]') as HTMLElement | null;
      if (tracked) {
        const href = tracked.getAttribute('data-track-href');
        if (!href || !isInternalHref(href)) return;
        event.preventDefault();
        window.location.assign(appendUtmToHref(href));
      }
    },
    true,
  );
}

export function trackNavigate(href: string): void {
  if (typeof window === 'undefined') return;
  window.location.assign(appendUtmToHref(href));
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
