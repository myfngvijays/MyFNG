import { istYmd, type CrmDatePreset } from '@/lib/telecaller/crmDateRange';

const STORAGE_KEY = 'myfng:telecaller_crm_filters_v2';

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

export function defaultTelecallerCrmFilterPrefs(): TelecallerCrmFilterPrefs {
  const today = istYmd();
  return {
    datePreset: 'last_7_days',
    customStart: today,
    customEnd: today,
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
  return {
    datePreset: VALID_PRESETS.has(preset) ? preset : defaults.datePreset,
    customStart: String(raw?.customStart || defaults.customStart).slice(0, 10),
    customEnd: String(raw?.customEnd || defaults.customEnd).slice(0, 10),
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

function readRaw(): Partial<TelecallerCrmFilterPrefs> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
    // Migrate v1 key if present
    const legacy = window.localStorage.getItem('myfng:telecaller_crm_filters_v1');
    if (legacy) return JSON.parse(legacy);
    return null;
  } catch {
    return null;
  }
}

export function loadTelecallerCrmFilterPrefs(): TelecallerCrmFilterPrefs {
  if (typeof window === 'undefined') return defaultTelecallerCrmFilterPrefs();
  try {
    return normalizePrefs(readRaw());
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
