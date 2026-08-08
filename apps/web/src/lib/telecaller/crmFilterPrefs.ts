import { istYmd, type CrmDatePreset } from '@/lib/telecaller/crmDateRange';

const STORAGE_KEY = 'myfng:telecaller_crm_filters_v1';

const VALID_PRESETS = new Set<CrmDatePreset>([
  'today',
  'yesterday',
  'last_3_days',
  'last_7_days',
  'last_14_days',
  'this_month',
  'last_month',
  'custom',
]);

export type TelecallerCrmFilterPrefs = {
  datePreset: CrmDatePreset;
  customStart: string;
  customEnd: string;
  statusFilter: string;
};

export function defaultTelecallerCrmFilterPrefs(): TelecallerCrmFilterPrefs {
  const today = istYmd();
  return {
    datePreset: 'last_7_days',
    customStart: today,
    customEnd: today,
    statusFilter: 'all',
  };
}

function normalizePrefs(raw: Partial<TelecallerCrmFilterPrefs> | null | undefined): TelecallerCrmFilterPrefs {
  const defaults = defaultTelecallerCrmFilterPrefs();
  const preset = String(raw?.datePreset || defaults.datePreset) as CrmDatePreset;
  return {
    datePreset: VALID_PRESETS.has(preset) ? preset : defaults.datePreset,
    customStart: String(raw?.customStart || defaults.customStart).slice(0, 10),
    customEnd: String(raw?.customEnd || defaults.customEnd).slice(0, 10),
    statusFilter: String(raw?.statusFilter || defaults.statusFilter || 'all').trim() || 'all',
  };
}

export function loadTelecallerCrmFilterPrefs(): TelecallerCrmFilterPrefs {
  if (typeof window === 'undefined') return defaultTelecallerCrmFilterPrefs();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultTelecallerCrmFilterPrefs();
    return normalizePrefs(JSON.parse(raw));
  } catch {
    return defaultTelecallerCrmFilterPrefs();
  }
}

export function saveTelecallerCrmFilterPrefs(
  partial: Partial<TelecallerCrmFilterPrefs>,
): TelecallerCrmFilterPrefs {
  const next = normalizePrefs({ ...loadTelecallerCrmFilterPrefs(), ...partial });
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore quota / private mode
    }
  }
  return next;
}
