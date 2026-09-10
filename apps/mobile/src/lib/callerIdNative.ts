import { NativeModules, PermissionsAndroid, Platform } from 'react-native';
import { ENV } from '../config/environment';
import { apiFetch } from './api';

type CallerIdNative = {
  syncAuth: (apiUrl: string, token: string) => void;
  setPendingCall: (payload: Record<string, string>) => void;
  clearPendingCall: () => void;
  setEnabled: (enabled: boolean) => void;
  getStatus: () => Promise<{
    enabled: boolean;
    overlay: boolean;
    supported: boolean;
    directoryEnabled?: boolean;
    count?: number;
    error?: string;
  }>;
  requestOverlayPermission: () => void;
  preview: () => void;
  openIdentificationSettings?: () => void;
  syncDirectory?: (
    entries: Array<{ phone: string; label: string }>,
  ) => Promise<{ ok?: boolean; count?: number; error?: string }>;
};

const native = NativeModules.MyFNGCallerId as CallerIdNative | undefined;

export function isCallerIdNativeSupported(): boolean {
  return Boolean(native);
}

export function syncCallerIdAuth(token?: string | null) {
  if (!native) return;
  native.syncAuth(ENV.API_URL, String(token || ''));
}

export function setCallerIdPending(input: {
  leadId?: string | null;
  name?: string | null;
  phone?: string | null;
  leadNumber?: string | null;
  place?: string | null;
  direction?: 'inbound' | 'outbound' | string | null;
  sessionId?: string | null;
}) {
  if (!native) return;
  native.setPendingCall({
    leadId: String(input.leadId || ''),
    name: String(input.name || ''),
    phone: String(input.phone || ''),
    leadNumber: String(input.leadNumber || ''),
    place: String(input.place || ''),
    direction: String(input.direction || 'outbound'),
    sessionId: String(input.sessionId || ''),
  });
}

export function clearCallerIdPending() {
  native?.clearPendingCall();
}

export async function getCallerIdStatus() {
  if (!native) return { enabled: false, overlay: false, supported: false };
  return native.getStatus();
}

export function setCallerIdEnabled(enabled: boolean) {
  native?.setEnabled(enabled);
}

export function openCallerIdOverlaySettings() {
  native?.requestOverlayPermission();
}

export function openIosCallerIdSettings() {
  native?.openIdentificationSettings?.() || native?.requestOverlayPermission();
}

export function previewCallerIdOverlay() {
  native?.preview();
}

export async function requestCallerIdPhonePermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  const result = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
    PermissionsAndroid.PERMISSIONS.READ_CALL_LOG,
  ]);
  return (
    result[PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE] === PermissionsAndroid.RESULTS.GRANTED
  );
}

export async function syncIosCallerDirectory(): Promise<{
  ok: boolean;
  count: number;
  error?: string;
}> {
  if (Platform.OS !== 'ios' || !native?.syncDirectory) {
    return { ok: false, count: 0, error: 'not_ios' };
  }
  try {
    const json = await apiFetch<{
      entries?: Array<{ phone: string; label: string }>;
    }>('/api/telecaller/crm/caller-id-directory');
    const entries = Array.isArray(json?.entries) ? json.entries : [];
    const result = await native.syncDirectory(
      entries.map((row) => ({
        phone: String(row.phone || ''),
        label: String(row.label || ''),
      })),
    );
    return {
      ok: Boolean(result?.ok),
      count: Number(result?.count || entries.length || 0),
      error: result?.error,
    };
  } catch (e: any) {
    return { ok: false, count: 0, error: String(e?.message || e) };
  }
}
