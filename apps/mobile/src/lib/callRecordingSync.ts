import { AppState, Platform, PermissionsAndroid } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { apiFetch } from './api';
import {
  nativeCallRecordingSafAvailable,
  nativeCheckFsPath,
  nativeCheckRecordingFolder,
  nativeListAudioEntries,
  nativeListAudioFromFsPath,
  nativeNormalizeFsPath,
  nativePickRecordingFolder,
  normalizeSafTreeUri,
  isFsRecordingUri,
  fsPathFromRecordingUri,
} from './callRecordingSafNative';

const STORE_KEY = 'myfng.telecaller.callRecordingFolder';
const SYNCED_KEY = 'myfng.telecaller.syncedCallRecordings';
const SYNC_HISTORY_KEY = 'myfng.telecaller.recordingSyncHistory';
const AUDIO = /\.(mp3|m4a|amr|wav|aac|3gp|ogg|mp4)$/i;

export type RecordingSyncHistoryRow = {
  id: string;
  at: number;
  manual: boolean;
  status: 'success' | 'failed' | 'partial';
  /** Audio files in the folder (whole folder). */
  scanned?: number;
  /** Recordings inside the chosen time window. */
  found?: number;
  uploaded: number;
  noMatch: number;
  skipped: number;
  failed?: number;
  /** e.g. "3 no phone number in file name · 2 already uploaded" */
  skipNote?: string;
  error?: string;
  windowLabel?: string;
  durationMs?: number;
};

export type RecordingFolder = {
  uri: string;
  label: string;
  autoSince: number;
  /** Absolute path when uri is `fs:...` */
  fsPath?: string;
};

export type SyncResult = {
  scanned: number;
  found: number;
  uploaded: number;
  noMatch: number;
  skipped: number;
  failed: number;
  skipNote?: string;
  error?: string;
  morePending?: boolean;
};

export type RecordingSyncProgress = {
  running: boolean;
  manual: boolean;
  windowLabel?: string;
  phase: 'listing' | 'checking' | 'uploading' | 'done';
  scanned: number;
  checked: number;
  found: number;
  processed: number;
  uploaded: number;
  noMatch: number;
  skipped: number;
  failed: number;
  current?: string;
  startedAt: number;
  /** Final row once phase === 'done'. */
  result?: RecordingSyncHistoryRow;
};

const HISTORY_CAP = 40;

async function appendSyncHistory(row: Omit<RecordingSyncHistoryRow, 'id'>) {
  const full: RecordingSyncHistoryRow = { ...row, id: `${row.at}-${Math.random().toString(36).slice(2, 8)}` };
  let next: RecordingSyncHistoryRow[] = [full];
  try {
    const raw = await AsyncStorage.getItem(SYNC_HISTORY_KEY);
    const list = raw ? JSON.parse(raw) : [];
    next = [full, ...(Array.isArray(list) ? (list as RecordingSyncHistoryRow[]) : [])].slice(0, HISTORY_CAP);
  } catch {
    /* corrupt history — start fresh with this row */
  }
  try {
    await AsyncStorage.setItem(SYNC_HISTORY_KEY, JSON.stringify(next));
  } catch {
    /* still notify the open screen below */
  }
  historyListeners.forEach((fn) => {
    try {
      fn(next);
    } catch {
      /* ignore */
    }
  });
  return full;
}

const historyListeners = new Set<(rows: RecordingSyncHistoryRow[]) => void>();

export function subscribeRecordingSyncHistory(fn: (rows: RecordingSyncHistoryRow[]) => void) {
  historyListeners.add(fn);
  return () => {
    historyListeners.delete(fn);
  };
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

let progress: RecordingSyncProgress | null = null;
const progressListeners = new Set<(p: RecordingSyncProgress | null) => void>();

function emitProgress(next: RecordingSyncProgress | null) {
  progress = next;
  progressListeners.forEach((fn) => {
    try {
      fn(next);
    } catch {
      /* ignore */
    }
  });
}

export function subscribeRecordingSyncProgress(fn: (p: RecordingSyncProgress | null) => void) {
  progressListeners.add(fn);
  fn(progress);
  return () => {
    progressListeners.delete(fn);
  };
}

export function getRecordingSyncProgress() {
  return progress;
}

/** Phone storage only. Google Drive / Photos / other cloud "folders" can't be listed by the app. */
const LOCAL_STORAGE_AUTHORITY = 'com.android.externalstorage.documents';

export function isPhoneStorageFolder(uri: string) {
  if (isFsRecordingUri(uri)) return true;
  return String(uri || '').startsWith(`content://${LOCAL_STORAGE_AUTHORITY}/`);
}

export const DEFAULT_RECORDING_FS_PATH = 'Recordings/Call';

export function labelFromFsPath(absPath: string) {
  const root = '/storage/emulated/0';
  const norm = String(absPath || '').replace(/\\/g, '/');
  if (norm.startsWith(root)) {
    const tail = norm.slice(root.length).replace(/^\/+/, '');
    return tail ? `Internal storage / ${tail.split('/').join(' / ')}` : 'Internal storage';
  }
  return norm.split('/').filter(Boolean).join(' / ') || 'Recording folder';
}

export const NOT_PHONE_FOLDER_MESSAGE =
  'Ye phone ka folder nahi hai (Google Drive / cloud folder chuna gaya). "Change folder" dabakar left menu se phone ki memory kholein → Recordings → Call chunein → "Use this folder" → Allow.';

export const RECORDING_FOLDER_PICK_HINT =
  'Select folder par My Files / phone storage khulega (Drive nahi). Agar Drive dikhe to back karke dubara Select folder dabayein. Ya neeche path likh kar Save path karein — default: Recordings/Call';

function cloudFolderLabel(uri: string) {
  const u = String(uri || '');
  if (/com\.google\.android\.apps\.docs/.test(u)) return 'Google Drive folder (not supported)';
  if (/com\.google\.android\.apps\.photos/.test(u)) return 'Google Photos (not supported)';
  return 'Cloud folder (not supported)';
}

/** "Internal storage / Recordings / Call" from a SAF tree URI. */
function folderLabel(uri: string) {
  if (isFsRecordingUri(uri)) return labelFromFsPath(fsPathFromRecordingUri(uri));
  if (uri && String(uri).startsWith('content://') && !isPhoneStorageFolder(uri)) return cloudFolderLabel(uri);
  try {
    const decoded = decodeURIComponent(String(uri || ''));
    const treeMatch = decoded.match(/\/tree\/(.+?)(?:\/document\/|$)/);
    const tree = treeMatch ? treeMatch[1] : decoded.split('/').pop() || decoded;
    const colon = tree.indexOf(':');
    const volume = colon >= 0 ? tree.slice(0, colon) : '';
    const path = (colon >= 0 ? tree.slice(colon + 1) : tree).replace(/\+/g, ' ').trim();
    const root =
      volume === 'primary' ? 'Internal storage' : volume === 'downloads' ? 'Downloads' : volume ? 'SD card' : '';
    const parts = [root, ...path.split('/').map((p) => p.trim()).filter(Boolean)].filter(Boolean);
    return parts.join(' / ') || 'Recording folder';
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

function normalizeFolder(row: RecordingFolder): RecordingFolder {
  const label = String(row.label || '').trim();
  return {
    ...row,
    // Older builds stored the raw content:// URI (or just "Call") as the label.
    label: !label || label.startsWith('content://') || !label.includes('/') ? folderLabel(row.uri) : label,
  };
}

async function folderAccessOk(uri: string) {
  const check = await checkRecordingFolder(uri);
  return check.ok;
}

async function ensureFsReadPermission() {
  if (Platform.OS !== 'android') return;
  const api = Number(Platform.Version);
  try {
    if (api >= 33) {
      await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO);
    } else if (api >= 23) {
      await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE);
    }
  } catch {
    /* best effort */
  }
}

/** Phone copy wins (it is the one with the Android permission); server copy only fills an empty phone. */
export async function loadRecordingFolder() {
  const local = await readFolder();
  let row = local ? normalizeFolder(local) : null;
  if (row?.uri) row = { ...row, uri: normalizeSafTreeUri(row.uri) };
  if (!row) {
    try {
      const remote = await apiFetch<{ path?: { uri?: string; label?: string; auto_since?: number } | null }>(
        '/api/telecaller/profile/recording-path',
        { timeoutMs: 8000 },
      );
      if (remote?.path?.uri) {
        row = normalizeFolder({
          uri: normalizeSafTreeUri(remote.path.uri),
          label: remote.path.label || '',
          autoSince: Number(remote.path.auto_since || Date.now()),
        });
      }
    } catch {
      // Phone copy is enough.
    }
  }
  if (!row?.uri) return null;
  if (Platform.OS === 'android') {
    let accessOk = await folderAccessOk(row.uri);
    if (!accessOk) {
      await new Promise((r) => setTimeout(r, 500));
      accessOk = await folderAccessOk(row.uri);
    }
    if (!accessOk) {
      await AsyncStorage.removeItem(STORE_KEY);
      return null;
    }
  }
  if (local?.uri !== row.uri) {
    await AsyncStorage.setItem(STORE_KEY, JSON.stringify(row));
  }
  return row;
}

export async function saveRecordingFolderFromPath(input: string) {
  if (Platform.OS !== 'android') {
    throw new Error('Call recording sync sirf Android phone par chalta hai.');
  }
  await ensureFsReadPermission();
  const trimmed = input.trim();
  if (!trimmed) throw new Error('Path likhiye — jaise Recordings/Call');
  let abs = trimmed;
  if (nativeCallRecordingSafAvailable()) {
    const normalized = await nativeNormalizeFsPath(trimmed);
    if (normalized) abs = normalized;
  } else {
    const t = trimmed.replace(/^internal storage[/\s]+/i, '').replace(/^\/+/, '');
    abs = t.startsWith('storage/') ? `/${t}` : `/storage/emulated/0/${t}`;
  }
  const verify = await checkRecordingFolder(`fs:${abs}`);
  if (!verify.ok) {
    throw new Error(
      verify.error ||
        'Folder nahi mila ya permission nahi. Path check karein (jaise Recordings/Call).',
    );
  }
  const label = labelFromFsPath(abs);
  const next: RecordingFolder = {
    uri: `fs:${abs}`,
    fsPath: abs,
    label,
    autoSince: Date.now(),
  };
  await AsyncStorage.setItem(STORE_KEY, JSON.stringify(next));
  void apiFetch('/api/telecaller/profile/recording-path', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uri: next.uri, label: next.label, auto_since: next.autoSince }),
    timeoutMs: 10000,
  }).catch(() => {
    /* kept on the phone */
  });
  return next;
}

export async function saveRecordingFolder(uri: string) {
  const trimmed = normalizeSafTreeUri(String(uri || '').trim());
  const next: RecordingFolder = {
    uri: trimmed,
    label: trimmed.startsWith('content://') ? folderLabel(trimmed) : trimmed || 'Recording folder',
    autoSince: Date.now(),
  };
  await AsyncStorage.setItem(STORE_KEY, JSON.stringify(next));
  // Backup to the profile in the background — never block the screen on the network.
  void apiFetch('/api/telecaller/profile/recording-path', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uri: next.uri, label: next.label, auto_since: next.autoSince }),
    timeoutMs: 10000,
  }).catch(() => {
    /* kept on the phone */
  });
  return next;
}

let pickerOpenSince = 0;
let pickerClosedAt = 0;

/** True while the Android folder picker is open, and a few seconds after it closes. */
export function isRecordingFolderPickerBusy() {
  if (pickerOpenSince) return true;
  return pickerClosedAt > 0 && Date.now() - pickerClosedAt < 6000;
}

const SUGGESTED_FOLDER = 'Recordings/Call';

export async function pickRecordingFolder() {
  if (Platform.OS !== 'android') {
    throw new Error('Call recording sync sirf Android phone par chalta hai.');
  }
  pickerOpenSince = Date.now();
  try {
    let directoryUri: string | null = null;
    if (nativeCallRecordingSafAvailable()) {
      const permission = await nativePickRecordingFolder(SUGGESTED_FOLDER);
      if (!permission?.granted || !permission.directoryUri) return null;
      directoryUri = permission.directoryUri;
    } else {
      const SAF = FileSystem.StorageAccessFramework;
      const permission = await SAF.requestDirectoryPermissionsAsync(SAF.getUriForDirectoryInRoot(SUGGESTED_FOLDER));
      if (!permission.granted || !permission.directoryUri) return null;
      directoryUri = permission.directoryUri;
    }
    directoryUri = normalizeSafTreeUri(directoryUri);
    if (!isPhoneStorageFolder(directoryUri)) {
      throw new Error(NOT_PHONE_FOLDER_MESSAGE);
    }
    const verify = await checkRecordingFolder(directoryUri);
    if (!verify.ok) {
      throw new Error(
        verify.error ||
          'Folder padh nahi paa rahe. Internal storage → Recordings → Call chunein, phir Allow dabayein.',
      );
    }
    const saved = await saveRecordingFolder(directoryUri);
    if (verify.audio === 0) {
      saved.label = `${saved.label || 'Recording folder'} · abhi 0 file (Call ke andar ho to SYNC chalega)`;
      await AsyncStorage.setItem(STORE_KEY, JSON.stringify(saved));
    }
    return saved;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '';
    if (/pending|already/i.test(msg)) {
      throw new Error('Folder picker pehle se khula hai. App band karke dobara kholein, phir Select folder dabayein.');
    }
    throw e;
  } finally {
    pickerOpenSince = 0;
    pickerClosedAt = Date.now();
  }
}

/** Reads the chosen folder now — confirms Android still allows access and counts audio files. */
export async function checkRecordingFolder(uri: string): Promise<{ ok: boolean; audio: number; error?: string }> {
  if (Platform.OS !== 'android') return { ok: false, audio: 0, error: 'Android only' };
  if (isFsRecordingUri(uri)) {
    const path = fsPathFromRecordingUri(uri);
    const native = await nativeCheckFsPath(path);
    if (native) return native;
    return { ok: false, audio: 0, error: 'Folder path check fail — path save dobara karein.' };
  }
  const tree = normalizeSafTreeUri(uri);
  if (!isPhoneStorageFolder(tree)) return { ok: false, audio: 0, error: NOT_PHONE_FOLDER_MESSAGE };
  if (nativeCallRecordingSafAvailable()) {
    const native = await nativeCheckRecordingFolder(tree);
    if (native) return native;
  }
  try {
    const list = await FileSystem.StorageAccessFramework.readDirectoryAsync(tree);
    return { ok: true, audio: list.filter((u) => AUDIO.test(decodeURIComponent(u))).length };
  } catch (e: unknown) {
    return {
      ok: false,
      audio: 0,
      error:
        (e instanceof Error ? e.message : '') ||
        'Folder padh nahi paa rahe. Select folder dobara dabakar wahi folder chunein.',
    };
  }
}

const metaCache = new Map<string, { recordedAt: number; size: number }>();

async function fileMeta(uri: string) {
  const hit = metaCache.get(uri);
  if (hit) return hit;
  try {
    const info = await FileSystem.getInfoAsync(uri);
    const modified = Number((info as { modificationTime?: number }).modificationTime || 0);
    const size = Number((info as { size?: number }).size || 0);
    const meta = { recordedAt: modified > 0 ? modified * 1000 : 0, size };
    if (meta.recordedAt) metaCache.set(uri, meta);
    return meta;
  } catch {
    return { recordedAt: 0, size: 0 };
  }
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(label)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

const SKIP_TEXT: Record<string, string> = {
  already: 'already uploaded',
  no_phone: 'no phone number in file name',
  too_large: 'file over 25 MB',
  not_audio: 'not an audio file',
  server: 'skipped by server',
  earlier_no_match: 'no matching call earlier',
};

function skipNoteOf(reasons: Record<string, number>) {
  return Object.entries(reasons)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${n} ${SKIP_TEXT[k] || k}`)
    .join(' · ');
}

type RunOpts = {
  manual: boolean;
  sinceMs?: number;
  onProgress?: (p: Partial<RecordingSyncProgress>) => void;
};

/**
 * One pass over the folder: list → read dates → upload what is in range.
 * Never throws; a fatal problem comes back as `error`.
 */
export async function syncPhoneRecordings(opts: RunOpts = { manual: false }): Promise<SyncResult> {
  const out: SyncResult = { scanned: 0, found: 0, uploaded: 0, noMatch: 0, skipped: 0, failed: 0 };
  const report = opts.onProgress || (() => {});
  if (Platform.OS !== 'android') {
    return { ...out, error: 'Call recording sync sirf Android phone par chalta hai.' };
  }
  const folder = await readFolder();
  if (!folder?.uri) {
    return { ...out, error: 'Pehle recording folder select karein ya path save karein.' };
  }
  if (!isPhoneStorageFolder(folder.uri)) return { ...out, error: NOT_PHONE_FOLDER_MESSAGE };

  report({ phase: 'listing' });
  let listed: Array<{ uri: string; name: string }> = [];
  try {
    if (isFsRecordingUri(folder.uri)) {
      const path = folder.fsPath || fsPathFromRecordingUri(folder.uri);
      const entries = await withTimeout(
        nativeListAudioFromFsPath(path) ?? Promise.resolve([]),
        180000,
        'Folder list karne mein bahut time lag gaya',
      );
      listed = (entries || []).map((row) => ({
        uri: row.uri,
        name: String(row.name || '').trim() || 'recording.m4a',
      }));
    } else {
      const treeUri = normalizeSafTreeUri(folder.uri);
      if (nativeCallRecordingSafAvailable()) {
        const entries = await withTimeout(
          nativeListAudioEntries(treeUri),
          180000,
          'Folder list karne mein bahut time lag gaya',
        );
        listed = (entries || []).map((row) => ({
          uri: row.uri,
          name: String(row.name || '').trim() || 'recording.m4a',
        }));
      } else {
        const uris = await withTimeout(
          FileSystem.StorageAccessFramework.readDirectoryAsync(treeUri),
          120000,
          'Folder list karne mein bahut time lag gaya',
        );
        listed = uris
          .filter((uri) => AUDIO.test(decodeURIComponent(uri)))
          .map((uri) => {
            const name = decodeURIComponent(uri).split('/').pop() || 'recording.m4a';
            return { uri, name };
          });
      }
    }
  } catch (e: unknown) {
    return {
      ...out,
      error: `Folder padh nahi paa rahe (${e instanceof Error ? e.message : 'no access'}). Select folder dobara karein.`,
    };
  }

  const synced = await readSynced();
  const unmatched = await readSet(NOMATCH_KEY);
  const audio = listed;
  out.scanned = audio.length;
  report({ phase: 'checking', scanned: audio.length, checked: 0 });

  const windowStart = opts.manual
    ? opts.sinceMs
      ? Date.now() - opts.sinceMs
      : 0
    : Math.max(0, folder.autoSince - 120000);

  // Read file dates (cached) in small parallel batches.
  const inWindow: Array<{ uri: string; name: string; recordedAt: number; size: number }> = [];
  const BATCH = 16;
  for (let i = 0; i < audio.length; i += BATCH) {
    const slice = audio.slice(i, i + BATCH);
    const metas = await Promise.all(slice.map((row) => fileMeta(row.uri)));
    slice.forEach((row, k) => {
      const m = metas[k];
      if (m.recordedAt && m.recordedAt >= windowStart) inWindow.push({ uri: row.uri, name: row.name, ...m });
    });
    report({ checked: Math.min(audio.length, i + BATCH), found: inWindow.length });
  }
  inWindow.sort((a, b) => b.recordedAt - a.recordedAt);
  out.found = inWindow.length;
  report({ phase: 'uploading', found: inWindow.length, processed: 0 });

  const reasons: Record<string, number> = {};
  const skip = (key: string) => {
    out.skipped += 1;
    reasons[key] = (reasons[key] || 0) + 1;
  };
  const failReasons: Record<string, number> = {};
  const uploadCap = opts.manual ? 300 : 8;
  let attempts = 0;
  let failStreak = 0;
  let processed = 0;

  const persist = async () => {
    await writeSynced(synced);
    await AsyncStorage.setItem(NOMATCH_KEY, JSON.stringify([...unmatched].slice(-400)));
  };

  for (const file of inWindow) {
    const name = file.name || decodeURIComponent(file.uri).split('/').pop() || 'recording.m4a';
    processed += 1;
    if (synced.has(file.uri)) {
      skip('already');
    } else if (!opts.manual && unmatched.has(file.uri)) {
      skip('earlier_no_match');
    } else if (!phonesInName(name).length) {
      synced.add(file.uri);
      skip('no_phone');
    } else if (file.size > 25 * 1024 * 1024) {
      synced.add(file.uri);
      skip('too_large');
    } else if (attempts >= uploadCap) {
      out.morePending = true;
      processed -= 1;
      break;
    } else {
      attempts += 1;
      report({ current: name, processed: processed - 1 });
      const form = new FormData();
      form.append('file', {
        uri: file.uri,
        name,
        type: name.toLowerCase().endsWith('.mp3') ? 'audio/mpeg' : 'audio/mp4',
      } as unknown as Blob);
      form.append('phone', phonesInName(name)[0]);
      form.append('recorded_at', String(file.recordedAt));
      try {
        const res = await apiFetch<{ status?: string; reason?: string; error?: string }>(
          '/api/telecaller/calls/device-recording',
          { method: 'POST', body: form as any, timeoutMs: 120000 },
        );
        failStreak = 0;
        if (res?.status === 'attached') {
          synced.add(file.uri);
          unmatched.delete(file.uri);
          out.uploaded += 1;
        } else if (res?.status === 'no_match') {
          unmatched.add(file.uri);
          out.noMatch += 1;
        } else if (res?.status === 'skipped') {
          synced.add(file.uri);
          skip(res.reason && SKIP_TEXT[res.reason] ? res.reason : 'server');
        } else {
          out.failed += 1;
          const why = String(res?.error || 'Unknown server reply');
          failReasons[why] = (failReasons[why] || 0) + 1;
        }
      } catch (e: unknown) {
        out.failed += 1;
        failStreak += 1;
        const why = e instanceof Error ? e.message : 'Upload failed';
        failReasons[why] = (failReasons[why] || 0) + 1;
        if (failStreak >= 3) {
          out.error = `Upload ruk gaya: ${why}`;
          break;
        }
      }
    }
    report({
      processed,
      uploaded: out.uploaded,
      noMatch: out.noMatch,
      skipped: out.skipped,
      failed: out.failed,
    });
    if (processed % 10 === 0) await persist();
  }

  await persist();
  out.skipNote = skipNoteOf(reasons) || undefined;
  if (!out.error && out.failed) {
    out.error = Object.entries(failReasons)
      .map(([why, n]) => `${n} failed: ${why}`)
      .join(' · ');
  }
  return out;
}

let listeners = 0;
let timer: ReturnType<typeof setInterval> | null = null;
let appStateSub: { remove: () => void } | null = null;
let bgRunning = false;
let manualJob: { sinceMs?: number; windowLabel?: string } | null = null;

async function runBackgroundSync(manual: boolean, sinceMs?: number, windowLabel?: string) {
  if (bgRunning) return;
  bgRunning = true;
  const startedAt = Date.now();
  let live: RecordingSyncProgress = {
    running: true,
    manual,
    windowLabel,
    phase: 'listing',
    scanned: 0,
    checked: 0,
    found: 0,
    processed: 0,
    uploaded: 0,
    noMatch: 0,
    skipped: 0,
    failed: 0,
    startedAt,
  };
  if (manual) emitProgress(live);
  let result: SyncResult = { scanned: 0, found: 0, uploaded: 0, noMatch: 0, skipped: 0, failed: 0 };
  try {
    result = await syncPhoneRecordings({
      manual,
      sinceMs: manual ? sinceMs : undefined,
      onProgress: (patch) => {
        live = { ...live, ...patch };
        if (manual) emitProgress(live);
      },
    });
  } catch (e: unknown) {
    result = { ...result, error: e instanceof Error ? e.message : 'Sync failed' };
  } finally {
    try {
      const touched = result.uploaded + result.noMatch + result.failed;
      const status: RecordingSyncHistoryRow['status'] =
        result.error && !result.uploaded && !result.noMatch
          ? 'failed'
          : result.error || result.failed
            ? 'partial'
            : 'success';
      const folderMissing =
        Boolean(result.error && /Pehle recording folder select karein/i.test(result.error));
      // Auto runs only log when something happened, so history is not flooded.
      if (!folderMissing && (manual || touched > 0 || result.error)) {
        const row = await appendSyncHistory({
          at: Date.now(),
          manual,
          status,
          scanned: result.scanned,
          found: result.found,
          uploaded: result.uploaded,
          noMatch: result.noMatch,
          skipped: result.skipped,
          failed: result.failed,
          skipNote: result.skipNote,
          error: result.error,
          windowLabel: manual ? windowLabel : 'Auto',
          durationMs: Date.now() - startedAt,
        });
        if (manual) emitProgress({ ...live, ...result, running: false, phase: 'done', result: row });
      } else if (manual) {
        emitProgress(null);
      }
    } finally {
      bgRunning = false;
      if (manualJob) {
        const job = manualJob;
        manualJob = null;
        void runBackgroundSync(true, job.sinceMs, job.windowLabel);
      }
    }
  }
}

/** Queue a manual sync — UI stays responsive; progress via subscribeRecordingSyncProgress. */
export function queueManualRecordingSync(opts: { sinceMs?: number; windowLabel?: string }) {
  if (bgRunning) {
    manualJob = opts;
    return 'queued' as const;
  }
  void runBackgroundSync(true, opts.sinceMs, opts.windowLabel);
  return 'started' as const;
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
