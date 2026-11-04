import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { istYmd, type CrmDatePreset } from './crmDateRange';

const STORAGE_KEY = 'myfng:workshop_date_filter_v1';

const VALID_PRESETS = new Set<string>([
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

export type WorkshopDateFilterPrefs = {
  datePreset: CrmDatePreset;
  customStart: string;
  customEnd: string;
};

let memory: WorkshopDateFilterPrefs | null = null;

export function defaultWorkshopDateFilter(): WorkshopDateFilterPrefs {
  const today = istYmd();
  return { datePreset: 'today', customStart: today, customEnd: today };
}

function normalize(raw: Partial<WorkshopDateFilterPrefs> | null | undefined): WorkshopDateFilterPrefs {
  const defaults = defaultWorkshopDateFilter();
  const preset = String(raw?.datePreset || defaults.datePreset);
  return {
    datePreset: (VALID_PRESETS.has(preset) ? preset : defaults.datePreset) as CrmDatePreset,
    customStart: String(raw?.customStart || defaults.customStart).slice(0, 10),
    customEnd: String(raw?.customEnd || defaults.customEnd).slice(0, 10),
  };
}

export function getWorkshopDateFilterSync(): WorkshopDateFilterPrefs {
  return memory || defaultWorkshopDateFilter();
}

export async function loadWorkshopDateFilter(): Promise<WorkshopDateFilterPrefs> {
  if (memory) return memory;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    memory = raw ? normalize(JSON.parse(raw)) : defaultWorkshopDateFilter();
  } catch {
    memory = defaultWorkshopDateFilter();
  }
  return memory;
}

export async function saveWorkshopDateFilter(prefs: WorkshopDateFilterPrefs) {
  memory = normalize(prefs);
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
  } catch {
    /* keep memory copy */
  }
}

/** Same date choice on the advisor home and menu screens. */
export function useWorkshopDateFilter() {
  const initial = getWorkshopDateFilterSync();
  const [datePreset, setDatePresetState] = useState<CrmDatePreset>(initial.datePreset);
  const [customStart, setCustomStartState] = useState(initial.customStart);
  const [customEnd, setCustomEndState] = useState(initial.customEnd);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void loadWorkshopDateFilter().then((prefs) => {
        if (cancelled) return;
        setDatePresetState(prefs.datePreset);
        setCustomStartState(prefs.customStart);
        setCustomEndState(prefs.customEnd);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const apply = useCallback((partial: Partial<WorkshopDateFilterPrefs>) => {
    const next = normalize({ ...getWorkshopDateFilterSync(), ...partial });
    setDatePresetState(next.datePreset);
    setCustomStartState(next.customStart);
    setCustomEndState(next.customEnd);
    void saveWorkshopDateFilter(next);
  }, []);

  return {
    datePreset,
    customStart,
    customEnd,
    setDatePreset: (next: CrmDatePreset) => apply({ datePreset: next }),
    setCustomStart: (next: string) => apply({ customStart: next, datePreset: 'custom' }),
    setCustomEnd: (next: string) => apply({ customEnd: next, datePreset: 'custom' }),
  };
}
