import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter } from 'react-native';
import type { CrmNewLeadSoundId } from './crmNewLeadSounds';

export const CRM_NEW_LEAD_POPUP_PREF_EVENT = 'crm:newLeadPopupPref';
export const CRM_NEW_LEAD_SOUND_PREF_EVENT = 'crm:newLeadSoundPref';
const STORAGE_KEY = 'myfng:crm_new_lead_popup_v1';
const SOUND_ON_KEY = 'myfng:crm_new_lead_sound_on_v1';
const SOUND_ID_KEY = 'myfng:crm_new_lead_sound_id_v1';

const VALID_SOUND: Set<string> = new Set(['bright', 'soft', 'double', 'chime']);

export async function getCrmNewLeadPopupEnabled(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw === '0') return false;
    return true;
  } catch {
    return true;
  }
}

export async function setCrmNewLeadPopupEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
  DeviceEventEmitter.emit(CRM_NEW_LEAD_POPUP_PREF_EVENT, { enabled });
}

export async function getCrmNewLeadSoundEnabled(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(SOUND_ON_KEY);
    if (raw === '0') return false;
    return true;
  } catch {
    return true;
  }
}

export async function setCrmNewLeadSoundEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(SOUND_ON_KEY, enabled ? '1' : '0');
  DeviceEventEmitter.emit(CRM_NEW_LEAD_SOUND_PREF_EVENT, { soundEnabled: enabled });
}

export async function getCrmNewLeadSoundId(): Promise<CrmNewLeadSoundId> {
  try {
    const raw = await AsyncStorage.getItem(SOUND_ID_KEY);
    if (raw && VALID_SOUND.has(raw)) return raw as CrmNewLeadSoundId;
  } catch {
    /* ignore */
  }
  return 'bright';
}

export async function setCrmNewLeadSoundId(id: CrmNewLeadSoundId): Promise<void> {
  await AsyncStorage.setItem(SOUND_ID_KEY, id);
  DeviceEventEmitter.emit(CRM_NEW_LEAD_SOUND_PREF_EVENT, { soundId: id });
}