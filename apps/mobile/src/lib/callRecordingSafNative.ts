import { NativeModules, Platform } from 'react-native';

export type NativeSafPickResult = { granted: boolean; directoryUri: string } | null;

export type NativeSafCheckResult = { ok: boolean; audio: number; error?: string };

export type NativeSafAudioEntry = { uri: string; name: string };

type CallRecordingSafModule = {
  pickFolder: (initialRelPath: string | null) => Promise<NativeSafPickResult>;
  checkFolder: (treeUri: string) => Promise<NativeSafCheckResult>;
  listAudioEntries: (treeUri: string) => Promise<NativeSafAudioEntry[]>;
};

const mod = NativeModules.MyFNGCallRecordingSaf as CallRecordingSafModule | undefined;

export function nativeCallRecordingSafAvailable() {
  return Platform.OS === 'android' && typeof mod?.pickFolder === 'function';
}

export function normalizeSafTreeUri(uri: string) {
  const u = String(uri || '').trim();
  const idx = u.indexOf('/document/');
  return idx > 0 ? u.slice(0, idx) : u;
}

export async function nativePickRecordingFolder(initialRelPath: string) {
  if (!mod?.pickFolder) return null;
  return mod.pickFolder(initialRelPath);
}

export async function nativeCheckRecordingFolder(uri: string) {
  if (!mod?.checkFolder) return null;
  return mod.checkFolder(normalizeSafTreeUri(uri));
}

export async function nativeListAudioEntries(uri: string) {
  if (!mod?.listAudioEntries) return null;
  return mod.listAudioEntries(normalizeSafTreeUri(uri));
}