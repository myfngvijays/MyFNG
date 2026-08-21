import AsyncStorage from '@react-native-async-storage/async-storage';
import { istYmd, type CrmDatePreset } from './crmDateRange';

const STORAGE_KEY = 'myfng:telecaller_crm_filters_v3';
const LEGACY_KEYS = ['myfng:telecaller_crm_filters_v2', 'myfng:telecaller_crm_filters_v1'] as const;

const PREFS_TTL_MS = 2 * 60 * 60 * 1000;
const SEARCH_TTL_MS = 30 * 60 * 1000;

const VALID_PRESETS = new Set<string>([
  'today',
  'yesterday',
  'last_3_days',
  'last_7_days',
  'last_14_days',
  'this_month',
  'last_month',
  'custom',
  'all_time',
]);

export type TelecallerCrmFilterPrefs = {
  datePreset: CrmDatePreset;
  customStart: string;
  customEnd: string;
  dateField: 'created' | 'modified';
  statusFilter: string;
  lostReason: string;
  city: string;
  priority: string;
  q: string;
  advIncomplete: boolean;
  advFollowUp: boolean;
  advHasVehicle: boolean;
  advHasCoupon: boolean;
};

type StoredBag = {
  savedAt: number;
  searchAt?: number;
  prefs: Partial<TelecallerCrmFilterPrefs>;
};

export function defaultTelecallerCrmFilterPrefs(): TelecallerCrmFilterPrefs {
  const today = istYmd();
  return {
    datePreset: 'last_7_days' as CrmDatePreset,
    customStart: today,
    customEnd: today,
    dateField: 'created',
    statusFilter: 'all',
    lostReason: '',
    city: '',
    priority: '',
    q: '',
    advIncomplete: false,
    advFollowUp: false,
    advHasVehicle: false,
    advHasCoupon: false,
  };
}

function normalizePrefs(raw: Partial<TelecallerCrmFilterPrefs> | null | undefined): TelecallerCrmFilterPrefs {
  const defaults = defaultTelecallerCrmFilterPrefs();
  const preset = String(raw?.datePreset || defaults.datePreset);
  const dateFieldRaw = String((raw as any)?.dateField || defaults.dateField).toLowerCase();
  const dateField: 'created' | 'modified' =
    dateFieldRaw === 'modified' || dateFieldRaw === 'updated_at' ? 'modified' : 'created';
  return {
    datePreset: (VALID_PRESETS.has(preset) ? preset : defaults.datePreset) as CrmDatePreset,
    customStart: String(raw?.customStart || defaults.customStart).slice(0, 10),
    customEnd: String(raw?.customEnd || defaults.customEnd).slice(0, 10),
    dateField,
    statusFilter: String(raw?.statusFilter || defaults.statusFilter || 'all').trim() || 'all',
    lostReason: String(raw?.lostReason || '').trim(),
    city: String(raw?.city || '').trim(),
    priority: String(raw?.priority || '').trim(),
    q: String(raw?.q || '').trim(),
    advIncomplete: Boolean(raw?.advIncomplete),
    advFollowUp: Boolean(raw?.advFollowUp),
    advHasVehicle: Boolean(raw?.advHasVehicle),
    advHasCoupon: Boolean(raw?.advHasCoupon),
  };
}

async function readStored(): Promise<StoredBag | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.prefs) {
        return {
          savedAt: Number(parsed.savedAt) || 0,
          searchAt: parsed.searchAt != null ? Number(parsed.searchAt) : undefined,
          prefs: parsed.prefs,
        };
      }
      return { savedAt: Date.now(), prefs: parsed };
    }
    for (const key of LEGACY_KEYS) {
      const legacy = await AsyncStorage.getItem(key);
      if (!legacy) continue;
      try {
        return { savedAt: Date.now(), searchAt: Date.now(), prefs: JSON.parse(legacy) };
      } catch {
        /* continue */
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function writeStored(stored: StoredBag) {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    for (const key of LEGACY_KEYS) {
      await AsyncStorage.removeItem(key);
    }
  } catch {
    /* ignore */
  }
}

export async function clearTelecallerCrmFilterPrefs() {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
    for (const key of LEGACY_KEYS) {
      await AsyncStorage.removeItem(key);
    }
  } catch {
    /* ignore */
  }
}

export async function loadTelecallerCrmFilterPrefs(): Promise<TelecallerCrmFilterPrefs> {
  try {
    const stored = await readStored();
    if (!stored?.savedAt) return defaultTelecallerCrmFilterPrefs();
    if (Date.now() - stored.savedAt > PREFS_TTL_MS) {
      await clearTelecallerCrmFilterPrefs();
      return defaultTelecallerCrmFilterPrefs();
    }
    const prefs = normalizePrefs(stored.prefs);
    const searchAge = Date.now() - (stored.searchAt ?? stored.savedAt);
    if (searchAge > SEARCH_TTL_MS && prefs.q) {
      prefs.q = '';
      await writeStored({ ...stored, prefs: { ...stored.prefs, q: '' }, searchAt: undefined });
    }
    return prefs;
  } catch {
    return defaultTelecallerCrmFilterPrefs();
  }
}

export async function saveTelecallerCrmFilterPrefs(
  partial: Partial<TelecallerCrmFilterPrefs>,
): Promise<TelecallerCrmFilterPrefs> {
  const prevStored = await readStored();
  const base =
    prevStored && Date.now() - prevStored.savedAt <= PREFS_TTL_MS
      ? normalizePrefs(prevStored.prefs)
      : defaultTelecallerCrmFilterPrefs();
  const next = normalizePrefs({ ...base, ...partial });
  const now = Date.now();
  const searchChanged = Object.prototype.hasOwnProperty.call(partial, 'q');
  await writeStored({
    savedAt: now,
    searchAt: searchChanged ? now : prevStored?.searchAt ?? (next.q ? now : undefined),
    prefs: next,
  });
  return next;
}
