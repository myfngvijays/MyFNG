import type { CrmNewLeadSoundId } from './crmNewLeadWebSound';

const STORAGE_KEY = 'myfng:crm_new_lead_popup_v1';
const SOUND_ON_KEY = 'myfng:crm_new_lead_sound_on_v1';
const SOUND_ID_KEY = 'myfng:crm_new_lead_sound_id_v1';

export function readCrmNewLeadPopupEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== '0';
  } catch {
    return true;
  }
}

export function saveCrmNewLeadPopupEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
  } catch {
    /* ignore quota */
  }
}

export function readCrmNewLeadSoundEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(SOUND_ON_KEY) !== '0';
  } catch {
    return true;
  }
}

export function saveCrmNewLeadSoundEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SOUND_ON_KEY, enabled ? '1' : '0');
  } catch {
    /* ignore */
  }
}

export function readCrmNewLeadSoundId(): CrmNewLeadSoundId {
  if (typeof window === 'undefined') return 'bright';
  try {
    const raw = window.localStorage.getItem(SOUND_ID_KEY);
    if (raw === 'soft' || raw === 'double' || raw === 'chime' || raw === 'bright') return raw;
  } catch {
    /* ignore */
  }
  return 'bright';
}

export function saveCrmNewLeadSoundId(id: CrmNewLeadSoundId): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SOUND_ID_KEY, id);
  } catch {
    /* ignore */
  }
}