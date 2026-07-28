import {
  compareAppVersions,
  DEFAULT_APP_STORE_URL,
  DEFAULT_PLAY_STORE_URL,
  type MobilePlatform,
} from '@/lib/mobile-app-version-config';

const ANDROID_PACKAGE = 'com.myfng.app';
const IOS_BUNDLE_ID = 'com.myfng.app';

type StoreLatest = {
  version: string | null;
  storeUrl: string;
  source: 'app_store' | 'play_store' | 'none';
};

type CacheEntry = { value: StoreLatest; expiresAt: number };

const cache: Partial<Record<MobilePlatform, CacheEntry>> = {};
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function toVersion(raw: string | null | undefined): string | null {
  const text = String(raw || '').trim();
  const match = text.match(/\d+(?:\.\d+){1,3}/);
  return match ? match[0] : null;
}

async function fetchIosLatest(): Promise<StoreLatest> {
  const fallback: StoreLatest = {
    version: null,
    storeUrl: DEFAULT_APP_STORE_URL,
    source: 'none',
  };

  try {
    const url = `https://itunes.apple.com/lookup?bundleId=${encodeURIComponent(IOS_BUNDLE_ID)}&country=in`;
    const res = await fetch(url);
    if (!res.ok) return fallback;
    const json = await res.json().catch(() => null);
    const row = json?.results?.[0];
    const version = toVersion(row?.version);
    const storeUrl = String(row?.trackViewUrl || DEFAULT_APP_STORE_URL).trim() || DEFAULT_APP_STORE_URL;
    return { version, storeUrl, source: version ? 'app_store' : 'none' };
  } catch {
    return fallback;
  }
}

async function fetchAndroidLatest(): Promise<StoreLatest> {
  const fallback: StoreLatest = {
    version: null,
    storeUrl: DEFAULT_PLAY_STORE_URL,
    source: 'none',
  };

  try {
    const url = `https://play.google.com/store/apps/details?id=${encodeURIComponent(ANDROID_PACKAGE)}&hl=en&gl=in`;
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
        'Accept-Language': 'en-IN,en;q=0.9',
      },
    });
    if (!res.ok) return fallback;
    const html = await res.text();

    const patterns = [
      /\[\[\["(\d+(?:\.\d+){1,3})"\]\],\[\[\[\d+,\d+\]\]\]\]/,
      /"softwareVersion"\s*:\s*"(\d+(?:\.\d+){1,3})"/,
      /Current Version[^0-9]*(\d+(?:\.\d+){1,3})/i,
      /\[\[\["(\d+\.\d+\.\d+)"\]\]/,
    ];

    let version: string | null = null;
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match?.[1]) {
        version = toVersion(match[1]);
        if (version) break;
      }
    }

    return {
      version,
      storeUrl: DEFAULT_PLAY_STORE_URL,
      source: version ? 'play_store' : 'none',
    };
  } catch {
    return fallback;
  }
}

export async function getStoreLatestVersion(platform: MobilePlatform): Promise<StoreLatest> {
  const hit = cache[platform];
  if (hit && Date.now() < hit.expiresAt) return hit.value;

  const value = platform === 'ios' ? await fetchIosLatest() : await fetchAndroidLatest();
  cache[platform] = { value, expiresAt: Date.now() + CACHE_TTL_MS };
  return value;
}

export function isStoreUpdateAvailable(
  currentVersion: string,
  storeVersion: string | null,
): boolean {
  if (!storeVersion) return false;
  return compareAppVersions(currentVersion || '0.0.0', storeVersion) < 0;
}
