import { NativeModules, Platform } from 'react-native';

export type NativeSafPickResult = { granted: boolean; directoryUri: string } | null;

export type NativeSafCheckResult = { ok: boolean; audio: number; error?: string };

export type NativeSafAudioEntry = { uri: string; name: string };

type CallRecordingSafModule = {
  pickFolder: (initialRelPath: string | null) => Promise<NativeSafPickResult>;
  checkFolder: (treeUri: string) => Promise<NativeSafCheckResult>;
  listAudioEntries: (treeUri: string) => Promise<NativeSafAudioEntry[]>;
  normalizeFsPath: (input: string) => Promise<string>;
  checkFsPath: (path: string) => Promise<NativeSafCheckResult>;
  listAudioFromFsPath: (path: string) => Promise<NativeSafAudioEntry[]>;
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

export function isFsRecordingUri(uri: string) {
  return String(uri || '').startsWith('fs:');
}

export function fsPathFromRecordingUri(uri: string) {
  return isFsRecordingUri(uri) ? String(uri).slice(3) : '';
}

export async function nativeNormalizeFsPath(input: string) {
  if (!mod?.normalizeFsPath) return null;
  return mod.normalizeFsPath(input);
}

export async function nativeCheckFsPath(path: string) {
  if (!mod?.checkFsPath) return null;
  return mod.checkFsPath(path);
}

export async function nativeListAudioFromFsPath(path: string) {
  if (!mod?.listAudioFromFsPath) return null;
  return mod.listAudioFromFsPath(path);
}