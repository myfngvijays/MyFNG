import { useEffect } from 'react';
import { Alert, AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch } from '../../lib/api';
import {
  canReturnAfterCall,
  ensureCallPermissions,
  openReturnAfterCallSettings,
} from '../../lib/phone';
import { ensureCrmLeadAfterPhoneCall, handleSimDialPush } from '../../lib/simDial';

/**
 * While the CRM app is open, pick up a Call pressed on the website and open
 * that lead plus the phone's line sheet. Push is a backup; this poll is what
 * makes an already-open app react immediately.
 */
const RETURN_PROMPT_KEY = 'myfng.telecaller.returnAfterCallPromptAt';
const RETURN_PROMPT_EVERY_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * Android, once: allow auto call, then "Display over other apps" so MyFNG
 * comes back to the lead when a call is cut (like TeleCRM).
 */
async function setUpAndroidCalling() {
  if (Platform.OS !== 'android') return;
  await ensureCallPermissions();
  if (await canReturnAfterCall()) return;
  const last = Number((await AsyncStorage.getItem(RETURN_PROMPT_KEY)) || 0);
  if (Date.now() - last < RETURN_PROMPT_EVERY_MS) return;
  await AsyncStorage.setItem(RETURN_PROMPT_KEY, String(Date.now()));
  Alert.alert(
    'Open MyFNG after every call',
    'To come back to the lead when a call ends, turn on "Display over other apps" for MyFNG on the next screen.',
    [
      { text: 'Not now', style: 'cancel' },
      { text: 'Turn on', onPress: () => openReturnAfterCallSettings() },
    ],
  );
}

export default function PhoneDialWatcher() {
  useEffect(() => {
    void setUpAndroidCalling();
  }, []);

  useEffect(() => {
    let stopped = false;

    const tick = async () => {
      if (stopped || AppState.currentState !== 'active') return;
      try {
        const json = await apiFetch<{
          pending?: { id?: string; lead_id?: string; phone?: string } | null;
        }>('/api/telecaller/phone-dial');
        const row = json?.pending;
        if (!row?.id || !row.phone) return;
        await handleSimDialPush({
          phone: row.phone,
          lead_id: row.lead_id || '',
          call_log_id: row.id,
          verified_pending: true,
        });
      } catch {
        // Next tick retries. A missing route or offline phone should stay quiet.
      }
    };

    void tick();
    const timer = setInterval(() => void tick(), 1500);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        ensureCrmLeadAfterPhoneCall();
        void tick();
      }
    });
    return () => {
      stopped = true;
      clearInterval(timer);
      sub.remove();
    };
  }, []);

  return null;
}
