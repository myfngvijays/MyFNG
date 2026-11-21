import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { apiFetch, apiUpload } from './api';

const STORE_KEY = 'myfng.telecaller.callRecordingFolder';
const SYNCED_KEY = 'myfng.telecaller.syncedCallRecordings';
const SYNC_HISTORY_KEY = 'myfng.telecaller.recordingSyncHistory';
const AUDIO = /\.(mp3|m4a|amr|wav|aac|3gp|ogg|mp4)$/i;

export type RecordingSyncHistoryRow = {
  id: string;
  at: number;
  manual: boolean;
  status: 'success' | 'failed' | 'partial';
  uploaded: number;
  noMatch: number;
  skipped: number;
  error?: string;
  windowLabel?: string;
};

export type RecordingFolder = {
  uri: string;
  label: string;
  autoSince: number;
};

export type SyncResult = {
  uploaded: number;
  noMatch: number;
  skipped: number;
  error?: string;
  morePending?: boolean;
};

const HISTORY_CAP = 40;

async function appendSyncHistory(row: Omit<RecordingSyncHistoryRow, 'id'>) {
  try {
    const raw = await AsyncStorage.getItem(SYNC_HISTORY_KEY);
    const list: RecordingSyncHistoryRow[] = raw ? JSON.parse(raw) : [];
    const next: RecordingSyncHistoryRow[] = [
      { ...row, id: `${row.at}:${row.uploaded}` },
      ...(Array.isArray(list) ? list : []),
    ].slice(0, HISTORY_CAP);
    await AsyncStorage.setItem(SYNC_HISTORY_KEY, JSON.stringify(next));
    historyListeners.forEach((fn) => {
      try {
        fn(next);
      } catch {
        /* ignore */
      }
    });
  } catch {
    /* ignore */
  }
}

const historyListeners = new Set<(rows: RecordingSyncHistoryRow[]) => void>();

export function subscribeRecordingSyncHistory(fn: (rows: RecordingSyncHistoryRow[]) => void) {
  historyListeners.add(fn);
  return () => historyListeners.delete(fn);
}

export async function loadRecordingSyncHistory(): Promise<RecordingSyncHistoryRow[]> {
  try {
    const raw = await AsyncStorage.getItem(SYNC_HISTORY_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? (list as RecordingSyncHistoryRow[]) : [];
  } catch {
    return [];
  }
}

function folderLabel(uri: string) {
  try {
    const decoded = decodeURIComponent(uri);
    const tail = decoded.split('/').pop() || decoded;
    const path = tail.includes(':') ? tail.split(':').slice(1).join(':') : tail;
    return path.replace(/\+/g, ' ').trim() || 'Recording folder';
  } catch {
    return 'Recording folder';
  }
}

export function recordingFolderLabel(uri: string) {
  return folderLabel(uri);
}

function phonesInName(name: string) {
  const runs = String(name || '').match(/\d{10,13}/g) || [];
  const found = runs.map((d) => d.slice(-10));
  if (!found.length) {
    const compact = String(name || '').replace(/\D/g, '');
    if (compact.length >= 10 && compact.length <= 13) found.push(compact.slice(-10));
  }
  return [...new Set(found.filter((d) => /^[6-9]\d{9}$/.test(d)))];
}

async function readFolder(): Promise<RecordingFolder | null> {
  const raw = await AsyncStorage.getItem(STORE_KEY);
  if (!raw) return null;
  try {
    const json = JSON.parse(raw) as RecordingFolder;
    if (!json?.uri) return null;
    return json;
  } catch {
    return null;
  }
}

const NOMATCH_KEY = 'myfng.telecaller.unmatchedCallRecordings';

async function readSet(key: string): Promise<Set<string>> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return new Set();
  try {
    const list = JSON.parse(raw);
    return new Set(Array.isArray(list) ? list.map(String) : []);
  } catch {
    return new Set();
  }
}

async function readSynced(): Promise<Set<string>> {
  return readSet(SYNCED_KEY);
}

async function writeSynced(set: Set<string>) {
  const list = [...set].slice(-400);
  await AsyncStorage.setItem(SYNCED_KEY, JSON.stringify(list));
}

export async function loadRecordingFolder() {
  const local = await readFolder();
  try {
    const remote = await apiFetch<{ path?: { uri?: string; label?: string; auto_since?: number } | null }>(
      '/api/telecaller/profile/recording-path',
    );
    if (remote?.path?.uri && (!local || local.uri !== remote.path.uri)) {
      const next: RecordingFolder = {
        uri: remote.path.uri,
        label: remote.path.label || folderLabel(remote.path.uri),
        autoSince: Number(remote.path.auto_since || Date.now()),
      };
      await AsyncStorage.setItem(STORE_KEY, JSON.stringify(next));
      return next;
    }
  } catch {
    // Phone copy is enough until the profile column is available.
  }
  return local;
}

export async function saveRecordingFolder(uri: string) {
  const trimmed = String(uri || '').trim();
  const next: RecordingFolder = {
    uri: trimmed,
    label: trimmed.startsWith('content://') ? folderLabel(trimmed) : trimmed || 'Recording folder',
    autoSince: Date.now(),
  };
  await AsyncStorage.setItem(STORE_KEY, JSON.stringify(next));
  try {
    await apiFetch('/api/telecaller/profile/recording-path', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uri: next.uri, label: next.label, auto_since: next.autoSince }),
    });
  } catch {
    // Kept on the phone. Profile column may not be migrated yet.
  }
  return next;
}

export async function pickRecordingFolder() {
  if (Platform.OS !== 'android') {
    throw new Error('Recording folder is chosen on the Android phone.');
  }
  const permission = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!permission.granted || !permission.directoryUri) return null;
  return saveRecordingFolder(permission.directoryUri);
}

async function fileMeta(uri: string) {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    const modified = Number((info as { modificationTime?: number }).modificationTime || 0);
    const size = Number((info as { size?: number }).size || 0);
    return { recordedAt: modified > 0 ? modified * 1000 : 0, size };
  } catch {
    return { recordedAt: 0, size: 0 };
  }
}

export async function syncPhoneRecordings(opts?: { manual?: boolean; sinceMs?: number }): Promise<SyncResult> {
  if (Platform.OS !== 'android') {
    return { uploaded: 0, noMatch: 0, skipped: 0, error: 'Recording sync runs on the Android phone.' };
  }
  const folder = await readFolder();
  if (!folder?.uri) return { uploaded: 0, noMatch: 0, skipped: 0, error: 'Choose the recording folder first' };

  let uris: string[] = [];
  try {
    uris = await FileSystem.StorageAccessFramework.readDirectoryAsync(folder.uri);
  } catch (e: unknown) {
    return {
      uploaded: 0,
      noMatch: 0,
      skipped: 0,
      error: e instanceof Error ? e.message : 'Could not read that folder',
    };
  }

  const synced = await readSynced();
  const unmatched = opts?.manual ? new Set<string>() : await readSet(NOMATCH_KEY);
  const audio = uris.filter((uri) => AUDIO.test(decodeURIComponent(uri)));
  const pending = audio.filter((uri) => !synced.has(uri) && !unmatched.has(uri));
  const cap = opts?.manual ? 12 : 8;
  const windowStart = opts?.sinceMs ? Date.now() - opts.sinceMs : 0;
  let uploaded = 0;
  let noMatch = 0;
  let skipped = 0;
  let tried = 0;

  for (const uri of pending) {
    if (tried >= cap) break;
    const name = decodeURIComponent(uri).split('/').pop() || 'recording.m4a';
    const phones = phonesInName(name);
    if (!phones.length) {
      synced.add(uri);
      skipped += 1;
      continue;
    }
    const { recordedAt, size } = await fileMeta(uri);
    if (size > 25 * 1024 * 1024) {
      synced.add(uri);
      skipped += 1;
      continue;
    }
    if (opts?.manual && windowStart && (!recordedAt || recordedAt < windowStart)) {
      continue;
    }
    if (!opts?.manual && (!recordedAt || recordedAt + 120000 < folder.autoSince)) {
      continue;
    }
    tried += 1;
    const form = new FormData();
    form.append('file', {
      uri,
      name,
      type: name.toLowerCase().endsWith('.mp3') ? 'audio/mpeg' : 'audio/mp4',
    } as unknown as Blob);
    form.append('phone', phones[0]);
    if (recordedAt) form.append('recorded_at', String(recordedAt));
    try {
      const res = await apiUpload<{ status?: string; error?: string }>('/api/telecaller/calls/device-recording', form);
      if (res?.status === 'attached') {
        synced.add(uri);
        unmatched.delete(uri);
        uploaded += 1;
      } else if (res?.status === 'no_match') {
        unmatched.add(uri);
        noMatch += 1;
      } else if (res?.status === 'skipped') {
        synced.add(uri);
        skipped += 1;
      } else if (res?.error) {
        await writeSynced(synced);
        await AsyncStorage.setItem(NOMATCH_KEY, JSON.stringify([...unmatched].slice(-400)));
        return { uploaded, noMatch, skipped, error: res.error };
      }
    } catch (e: unknown) {
      await writeSynced(synced);
      await AsyncStorage.setItem(NOMATCH_KEY, JSON.stringify([...unmatched].slice(-400)));
      return {
        uploaded,
        noMatch,
        skipped,
        error: e instanceof Error ? e.message : 'Upload failed',
      };
    }
  }

  await writeSynced(synced);
  await AsyncStorage.setItem(NOMATCH_KEY, JSON.stringify([...unmatched].slice(-400)));
  const morePending =
    tried >= cap &&
    pending.some((uri) => !synced.has(uri) && !unmatched.has(uri));
  return { uploaded, noMatch, skipped, morePending };
}

let listeners = 0;
let timer: ReturnType<typeof setInterval> | null = null;
let appStateSub: { remove: () => void } | null = null;
let bgRunning = false;
let manualJob: { sinceMs?: number; windowLabel?: string } | null = null;

async function runBackgroundSync(manual: boolean, sinceMs?: number, windowLabel?: string) {
  if (bgRunning) return;
  bgRunning = true;
  try {
    let totals = { uploaded: 0, noMatch: 0, skipped: 0 };
    let error: string | undefined;
    let rounds = 0;
    const maxRounds = manual ? 24 : 3;
    while (rounds < maxRounds) {
      const result = await syncPhoneRecordings({ manual, sinceMs: manual ? sinceMs : undefined });
      totals.uploaded += result.uploaded;
      totals.noMatch += result.noMatch;
      totals.skipped += result.skipped;
      if (result.error) {
        error = result.error;
        break;
      }
      rounds += 1;
      if (!result.morePending && result.uploaded + result.noMatch + result.skipped === 0) break;
      if (!result.morePending) break;
      await new Promise((r) => setTimeout(r, 400));
    }
  const status: RecordingSyncHistoryRow['status'] = error
    ? totals.uploaded + totals.noMatch + totals.skipped > 0
      ? 'partial'
      : 'failed'
    : 'success';
  await appendSyncHistory({
    at: Date.now(),
    manual,
    status,
    uploaded: totals.uploaded,
    noMatch: totals.noMatch,
    skipped: totals.skipped,
    error,
    windowLabel,
  });
  } finally {
    bgRunning = false;
    if (manualJob) {
      const job = manualJob;
      manualJob = null;
      void runBackgroundSync(true, job.sinceMs, job.windowLabel);
    }
  }
}

/** Queue a manual sync — UI stays responsive; runs in background with history rows per batch. */
export function queueManualRecordingSync(opts: { sinceMs?: number; windowLabel?: string }) {
  if (bgRunning) {
    manualJob = opts;
    return;
  }
  void runBackgroundSync(true, opts.sinceMs, opts.windowLabel);
}

export function isRecordingSyncRunning() {
  return bgRunning;
}

export function startPhoneRecordingAutoSync() {
  listeners += 1;
  if (Platform.OS === 'android' && !timer) {
    void runBackgroundSync(false);
    timer = setInterval(() => {
      void runBackgroundSync(false);
    }, 90_000);
    appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void runBackgroundSync(false);
    });
  }
  return () => {
    listeners = Math.max(0, listeners - 1);
    if (listeners === 0) {
      if (timer) clearInterval(timer);
      timer = null;
      appStateSub?.remove();
      appStateSub = null;
    }
  };
}
