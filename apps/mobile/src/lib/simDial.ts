import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { openPhoneCall } from './phone';
import { requestOpenCrmLead } from '../components/telecaller/IncomingCallLeadOverlay';

const HANDLED_DIALS_KEY = 'myfng.telecaller.handledPhoneDials';
const HANDLED_DIAL_TTL_MS = 7 * 24 * 60 * 60 * 1000;

let lastKey = '';
let lastAt = 0;
let lastOpenedLeadId = '';

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

async function wasDialHandled(callLogId: string): Promise<{ leadId?: string } | null> {
  if (!callLogId) return null;
  const map = await readHandledDials();
  return map[callLogId] || null;
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
 * Web clicked Call. Open that lead behind the system call sheet, then ask
 * iOS which line to use (Personal / business).
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
      if (stickyLead) {
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

  lastKey = key;
  lastAt = now;
  if (leadId) {
    lastOpenedLeadId = leadId;
    requestOpenCrmLead(leadId);
  }
  if (callLogId) void markDialHandled(callLogId, leadId);
  await new Promise((resolve) => setTimeout(resolve, 150));
  await openPhoneCall(phone);
  if (callLogId) await ackDial(callLogId);
}

/** After returning from the phone app, reopen the same CRM lead without redialing. */
export function ensureCrmLeadAfterPhoneCall(): void {
  if (AppState.currentState !== 'active') return;
  const id = String(lastOpenedLeadId || '').trim();
  if (id) requestOpenCrmLead(id);
}