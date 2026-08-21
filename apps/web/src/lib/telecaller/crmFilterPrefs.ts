import { istYmd, type CrmDatePreset } from '@/lib/telecaller/crmDateRange';

const STORAGE_KEY = 'myfng:telecaller_crm_filters_v3';
const LEGACY_KEYS = ['myfng:telecaller_crm_filters_v2', 'myfng:telecaller_crm_filters_v1'] as const;

/** Whole filter bag expires after this (logout also clears). */
const PREFS_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
/** Search text clears sooner even if other filters remain. */
const SEARCH_TTL_MS = 30 * 60 * 1000; // 30 minutes

const VALID_PRESETS = new Set<CrmDatePreset>([
  'today',
  'yesterday',
  'last_3_days',
  'last_7_days',
  'last_14_days',
  'this_month',
  'last_month',
  'all_time',
  'custom',
]);

export type TelecallerCrmFilterPrefs = {
  datePreset: CrmDatePreset;
  customStart: string;
  customEnd: string;
  /** created = Created on, modified = Modified (updated_at) */
  dateField: 'created' | 'modified';
  statusFilter: string;
  lostReason: string;
  city: string;
  priority: string;
  q: string;
  telecallerId: string;
  unassignedOnly: boolean;
  advIncomplete: boolean;
  advFollowUp: boolean;
  advHasVehicle: boolean;
  advHasCoupon: boolean;
  advNoAssignee: boolean;
};

type StoredBag = {
  savedAt: number;
  searchAt?: number;
  prefs: Partial<TelecallerCrmFilterPrefs>;
};

export function defaultTelecallerCrmFilterPrefs(): TelecallerCrmFilterPrefs {
  const today = istYmd();
  return {
    datePreset: 'last_7_days',
    customStart: today,
    customEnd: today,
    dateField: 'created',
    statusFilter: 'all',
    lostReason: '',
    city: '',
    priority: '',
    q: '',
    telecallerId: '',
    unassignedOnly: false,
    advIncomplete: false,
    advFollowUp: false,
    advHasVehicle: false,
    advHasCoupon: false,
    advNoAssignee: false,
  };
}

function normalizePrefs(raw: Partial<TelecallerCrmFilterPrefs> | null | undefined): TelecallerCrmFilterPrefs {
  const defaults = defaultTelecallerCrmFilterPrefs();
  const preset = String(raw?.datePreset || defaults.datePreset) as CrmDatePreset;
  const dateFieldRaw = String(raw?.dateField || defaults.dateField).toLowerCase();
  const dateField: 'created' | 'modified' =
    dateFieldRaw === 'modified' || dateFieldRaw === 'updated_at' ? 'modified' : 'created';
  return {
    datePreset: VALID_PRESETS.has(preset) ? preset : defaults.datePreset,
    customStart: String(raw?.customStart || defaults.customStart).slice(0, 10),
    customEnd: String(raw?.customEnd || defaults.customEnd).slice(0, 10),
    dateField,
    statusFilter: String(raw?.statusFilter || defaults.statusFilter || 'all').trim() || 'all',
    lostReason: String(raw?.lostReason || '').trim(),
    city: String(raw?.city || '').trim(),
    priority: String(raw?.priority || '').trim(),
    q: String(raw?.q || '').trim(),
    telecallerId: String(raw?.telecallerId || '').trim(),
    unassignedOnly: Boolean(raw?.unassignedOnly),
    advIncomplete: Boolean(raw?.advIncomplete),
    advFollowUp: Boolean(raw?.advFollowUp),
    advHasVehicle: Boolean(raw?.advHasVehicle),
    advHasCoupon: Boolean(raw?.advHasCoupon),
    advNoAssignee: Boolean(raw?.advNoAssignee),
  };
}

function readStored(): StoredBag | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && parsed.prefs) {
        return {
          savedAt: Number(parsed.savedAt) || 0,
          searchAt: parsed.searchAt != null ? Number(parsed.searchAt) : undefined,
          prefs: parsed.prefs,
        };
      }
      // Accidentally saved bare prefs under v3
      return { savedAt: Date.now(), prefs: parsed };
    }

    // Migrate legacy flat prefs → wrap with now so TTL starts fresh
    for (const key of LEGACY_KEYS) {
      const legacy = window.localStorage.getItem(key);
      if (!legacy) continue;
      try {
        const prefs = JSON.parse(legacy);
        return { savedAt: Date.now(), searchAt: Date.now(), prefs };
      } catch {
        /* continue */
      }
    }
    return null;
  } catch {
    return null;
  }
}

function writeStored(stored: StoredBag) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    for (const key of LEGACY_KEYS) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // ignore quota / private mode
  }
}

export function clearTelecallerCrmFilterPrefs() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    for (const key of LEGACY_KEYS) {
      window.localStorage.removeItem(key);
    }
  } catch {
    /* ignore */
  }
}

export function loadTelecallerCrmFilterPrefs(): TelecallerCrmFilterPrefs {
  if (typeof window === 'undefined') return defaultTelecallerCrmFilterPrefs();
  try {
    const stored = readStored();
    if (!stored?.savedAt) return defaultTelecallerCrmFilterPrefs();

    const age = Date.now() - stored.savedAt;
    if (age > PREFS_TTL_MS) {
      clearTelecallerCrmFilterPrefs();
      return defaultTelecallerCrmFilterPrefs();
    }

    const prefs = normalizePrefs(stored.prefs);
    const searchAge = Date.now() - (stored.searchAt ?? stored.savedAt);
    if (searchAge > SEARCH_TTL_MS && prefs.q) {
      prefs.q = '';
      writeStored({ ...stored, prefs: { ...stored.prefs, q: '' }, searchAt: undefined });
    }
    return prefs;
  } catch {
    return defaultTelecallerCrmFilterPrefs();
  }
}

export function saveTelecallerCrmFilterPrefs(
  partial: Partial<TelecallerCrmFilterPrefs>,
): TelecallerCrmFilterPrefs {
  const prevStored = readStored();
  const base =
    prevStored && Date.now() - prevStored.savedAt <= PREFS_TTL_MS
      ? normalizePrefs(prevStored.prefs)
      : defaultTelecallerCrmFilterPrefs();
  const next = normalizePrefs({ ...base, ...partial });
  const now = Date.now();
  const searchChanged = Object.prototype.hasOwnProperty.call(partial, 'q');
  writeStored({
    savedAt: now,
    searchAt: searchChanged ? now : prevStored?.searchAt ?? (next.q ? now : undefined),
    prefs: next,
  });
  return next;
}
