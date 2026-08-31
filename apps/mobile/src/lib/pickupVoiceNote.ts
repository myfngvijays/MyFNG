import { requireOptionalNativeModule } from 'expo-modules-core';
import { supabase } from './supabase';
import { ENV } from '../config/environment';

type ExpoAudio = typeof import('expo-audio');

let activeRecorder: InstanceType<ExpoAudio['AudioModule']['AudioRecorder']> | null = null;

const REBUILD_HINT =
  'Voice recording needs a fresh app build. Run: cd apps/mobile && npm run ios (or android). You can type the damage description for now.';

function hasExpoAudioNative(): boolean {
  return requireOptionalNativeModule('ExpoAudio') != null;
}

/** Safe sync check — does not load expo-audio JS bundle. */
export function isVoiceRecordingAvailable(): boolean {
  return hasExpoAudioNative();
}

async function loadExpoAudio(): Promise<ExpoAudio> {
  if (!hasExpoAudioNative()) {
    throw new Error(REBUILD_HINT);
  }
  return import('expo-audio');
}

export async function startVoiceNote(): Promise<void> {
  const { AudioModule, RecordingPresets, requestRecordingPermissionsAsync } = await loadExpoAudio();

  const perm = await requestRecordingPermissionsAsync();
  if (!perm.granted) {
    throw new Error('Microphone permission required');
  }

  if (activeRecorder?.isRecording) {
    await activeRecorder.stop();
  }

  activeRecorder = new AudioModule.AudioRecorder(RecordingPresets.HIGH_QUALITY);
  await activeRecorder.prepareToRecordAsync();
  activeRecorder.record();
}

export async function stopVoiceNote(): Promise<string | null> {
  if (!activeRecorder) return null;
  await activeRecorder.stop();
  const uri = activeRecorder.uri;
  activeRecorder = null;
  return uri;
}

export function isRecordingVoiceNote(): boolean {
  return Boolean(activeRecorder?.isRecording);
}

export async function transcribeVoiceNote(uri: string): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const formData = new FormData();
  // @ts-ignore — React Native FormData
  formData.append('file', {
    uri,
    name: 'damage-note.m4a',
    type: 'audio/m4a',
  });

  const response = await fetch(`${ENV.API_URL}/api/pickup/transcribe-audio`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: formData,
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.error || 'Transcription failed');
  }

  return String(result.text || '').trim();
}
