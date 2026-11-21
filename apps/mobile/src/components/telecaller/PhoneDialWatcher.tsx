import { useEffect } from 'react';
import { AppState } from 'react-native';
import { apiFetch } from '../../lib/api';
import { ensureCrmLeadAfterPhoneCall, handleSimDialPush } from '../../lib/simDial';

/**
 * While the CRM app is open, pick up a Call pressed on the website and open
 * that lead plus the phone's line sheet. Push is a backup; this poll is what
 * makes an already-open app react immediately.
 */
export default function PhoneDialWatcher() {
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
