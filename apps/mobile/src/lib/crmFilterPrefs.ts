import AsyncStorage from '@react-native-async-storage/async-storage';
import { istYmd, type CrmDatePreset } from './crmDateRange';

const STORAGE_KEY = 'myfng:telecaller_crm_filters_v2';
const LEGACY_KEY = 'myfng:telecaller_crm_filters_v1';

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

export async function loadTelecallerCrmFilterPrefs(): Promise<TelecallerCrmFilterPrefs> {
  try {
    const raw = (await AsyncStorage.getItem(STORAGE_KEY)) || (await AsyncStorage.getItem(LEGACY_KEY));
    if (!raw) return defaultTelecallerCrmFilterPrefs();
    return normalizePrefs(JSON.parse(raw));
  } catch {
    return defaultTelecallerCrmFilterPrefs();
  }
}

export async function saveTelecallerCrmFilterPrefs(
  partial: Partial<TelecallerCrmFilterPrefs>,
): Promise<TelecallerCrmFilterPrefs> {
  const current = await loadTelecallerCrmFilterPrefs();
  const next = normalizePrefs({ ...current, ...partial });
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}
