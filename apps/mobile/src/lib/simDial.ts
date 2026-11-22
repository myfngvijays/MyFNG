import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { placePhoneCall } from './phone';
import { requestOpenCrmLead } from '../components/telecaller/IncomingCallLeadOverlay';

const HANDLED_DIALS_KEY = 'myfng.telecaller.handledPhoneDials';
const HANDLED_DIAL_TTL_MS = 7 * 24 * 60 * 60 * 1000;
// Push + poll can both deliver the same Call. After this, a repeat (e.g. the
// old notification Firebase hands back on a cold start) must not reopen the lead.
const REPEAT_REOPEN_MS = 2 * 60 * 1000;

let lastKey = '';
let lastAt = 0;
let lastOpenedLeadId = '';
let lastDialAt = 0;

export function phoneFromDialPush(data?: Record<string, unknown> | null): string {
  return String(data?.phone || data?.to || '').replace(/\D/g, '').slice(-10);
}

async function readHandledDials(): Promise<Record<string, { leadId?: string; at: number }>> {
  try {
    const raw = await AsyncStorage.getItem(HANDLED_DIALS_KEY);
    if (!raw) return {};
    const json = JSON.parse(raw) as Record<string, { leadId?: string; at: number }>;
    if (!json || typeof json !== 'object') return {};
    const cutoff = Date.now() - HANDLED_DIAL_TTL_MS;
    const next: Record<string, { leadId?: string; at: number }> = {};
    for (const [id, row] of Object.entries(json)) {
      if (Number(row?.at || 0) >= cutoff) next[id] = row;
    }
    return next;
  } catch {
    return {};
  }
}

async function markDialHandled(callLogId: string, leadId: string) {
  if (!callLogId) return;
  const map = await readHandledDials();
  map[callLogId] = { leadId: leadId || map[callLogId]?.leadId, at: Date.now() };
  await AsyncStorage.setItem(HANDLED_DIALS_KEY, JSON.stringify(map));
}

async function wasDialHandled(callLogId: string): Promise<{ leadId?: string; at: number } | null> {
  if (!callLogId) return null;
  const map = await readHandledDials();
  return map[callLogId] || null;
}

async function isStillPending(callLogId: string): Promise<boolean> {
  try {
    const { apiFetch } = require('./api') as typeof import('./api');
    const json = await apiFetch<{ pending?: { status?: string } | null }>(
      `/api/telecaller/phone-dial?id=${encodeURIComponent(callLogId)}`,
    );
    const status = String(json?.pending?.status || '');
    return status === 'DEVICE_PENDING';
  } catch {
    return true; // offline check: keep the old behaviour and dial
  }
}

async function ackDial(callLogId: string) {
  try {
    const { apiFetch } = require('./api') as typeof import('./api');
    await apiFetch('/api/telecaller/phone-dial', {
      method: 'POST',
      body: JSON.stringify({ id: callLogId, action: 'ack' }),
    });
  } catch {
    // The dialer is already opening. A missed ack should not block it.
  }
}

/**
 * Web clicked Call. Open that lead, then place the call: on Android it rings
 * straight away (CALL_PHONE); on iOS the system asks which line to use.
 */
export async function handleSimDialPush(data?: Record<string, unknown> | null): Promise<void> {
  const phone = phoneFromDialPush(data);
  if (phone.length < 8) return;
  const leadId = String(data?.lead_id || '').trim();
  const callLogId = String(data?.call_log_id || '').trim();
  const key = callLogId || `${phone}:${leadId}`;
  const now = Date.now();

  if (callLogId) {
    const prior = await wasDialHandled(callLogId);
    if (prior) {
      const stickyLead = leadId || String(prior.leadId || '').trim();
      if (stickyLead && now - Number(prior.at || 0) < REPEAT_REOPEN_MS) {
        lastOpenedLeadId = stickyLead;
        requestOpenCrmLead(stickyLead);
      }
      void ackDial(callLogId);
      return;
    }
  }

  if (key === lastKey && now - lastAt < 120_000) {
    if (leadId) {
      lastOpenedLeadId = leadId;
      requestOpenCrmLead(leadId);
    }
    if (callLogId) void ackDial(callLogId);
    return;
  }

  // An old notification (Firebase repeats it on a cold start) must not dial again.
  if (callLogId && !data?.verified_pending && !(await isStillPending(callLogId))) {
    void markDialHandled(callLogId, leadId);
    return;
  }

  lastKey = key;
  lastAt = now;
  lastDialAt = now;
  if (leadId) {
    lastOpenedLeadId = leadId;
    requestOpenCrmLead(leadId);
  }
  if (callLogId) void markDialHandled(callLogId, leadId);
  await new Promise((resolve) => setTimeout(resolve, 150));
  await placePhoneCall(phone);
  if (callLogId) await ackDial(callLogId);
}

/** After returning from the phone app, reopen the same CRM lead without redialing. */
export function ensureCrmLeadAfterPhoneCall(): void {
  if (AppState.currentState !== 'active') return;
  const id = String(lastOpenedLeadId || '').trim();
  // Ignore the app flickering while the call screen opens; then reopen once only.
  if (!id || Date.now() - lastDialAt < 3000) return;
  lastOpenedLeadId = '';
  requestOpenCrmLead(id);
}