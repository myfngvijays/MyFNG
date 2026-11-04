'use client';

import { useCallback, useEffect, useState } from 'react';
import { istYmd, type CrmDatePreset } from '@/lib/telecaller/crmDateRange';

const STORAGE_KEY = 'myfng:workshop_date_filter_v1';

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

export type WorkshopDateFilterPrefs = {
  datePreset: CrmDatePreset;
  customStart: string;
  customEnd: string;
};

export function defaultWorkshopDateFilter(): WorkshopDateFilterPrefs {
  const today = istYmd();
  return { datePreset: 'today', customStart: today, customEnd: today };
}

function normalize(raw: Partial<WorkshopDateFilterPrefs> | null | undefined): WorkshopDateFilterPrefs {
  const defaults = defaultWorkshopDateFilter();
  const preset = String(raw?.datePreset || defaults.datePreset) as CrmDatePreset;
  return {
    datePreset: VALID_PRESETS.has(preset) ? preset : defaults.datePreset,
    customStart: String(raw?.customStart || defaults.customStart).slice(0, 10),
    customEnd: String(raw?.customEnd || defaults.customEnd).slice(0, 10),
  };
}

export function loadWorkshopDateFilter(): WorkshopDateFilterPrefs {
  if (typeof window === 'undefined') return defaultWorkshopDateFilter();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultWorkshopDateFilter();
    return normalize(JSON.parse(raw));
  } catch {
    return defaultWorkshopDateFilter();
  }
}

export function saveWorkshopDateFilter(prefs: WorkshopDateFilterPrefs) {
  if (typeof window === 'undefined') return;
  const next = normalize(prefs);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event('workshop-date-filter'));
  } catch {
    /* ignore quota / private mode */
  }
}

/** Same date choice on dashboard and every advisor menu page. */
export function useWorkshopDateFilter() {
  const [prefs, setPrefs] = useState<WorkshopDateFilterPrefs>(defaultWorkshopDateFilter);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setPrefs(loadWorkshopDateFilter());
    setReady(true);
    const sync = () => setPrefs(loadWorkshopDateFilter());
    window.addEventListener('workshop-date-filter', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('workshop-date-filter', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const setDateFilter = useCallback((next: WorkshopDateFilterPrefs) => {
    const normalized = normalize(next);
    setPrefs(normalized);
    saveWorkshopDateFilter(normalized);
  }, []);

  return { ...prefs, ready, setDateFilter };
}
