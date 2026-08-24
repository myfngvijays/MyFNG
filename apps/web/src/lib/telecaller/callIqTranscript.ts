/**
 * Call IQ Deep AI: recording → OpenAI transcript → SOP audit.
 * Only used on Deep AI / workflow Deep path — not on every free scan.
 */

import { fetchRecordingAudio } from '@/lib/telecaller/smartfloCdr';
import type { AnalyzeSopInput } from '@/lib/telecaller/callIqSop';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_TRANSCRIBE_MODEL =
  process.env.OPENAI_TRANSCRIBE_MODEL || 'gpt-4o-mini-transcribe';
const MAX_BYTES = 20 * 1024 * 1024;

function extFromType(contentType: string) {
  const t = contentType.toLowerCase();
  if (t.includes('wav')) return 'wav';
  if (t.includes('ogg')) return 'ogg';
  if (t.includes('webm')) return 'webm';
  if (t.includes('mp4') || t.includes('m4a')) return 'm4a';
  return 'mp3';
}

export async function transcribeCallRecording(
  recordingUrl: string,
): Promise<{ text: string | null; warning?: string }> {
  const url = String(recordingUrl || '').trim();
  if (!url) return { text: null, warning: 'No recording URL' };
  if (!OPENAI_API_KEY) return { text: null, warning: 'OPENAI_API_KEY missing' };

  const audio = await fetchRecordingAudio(url);
  if (!audio.ok) {
    return { text: null, warning: audio.error || `Recording fetch failed (${audio.status})` };
  }
  if (!audio.body.byteLength) return { text: null, warning: 'Empty recording' };
  if (audio.body.byteLength > MAX_BYTES) {
    return { text: null, warning: 'Recording too large to transcribe' };
  }

  const ext = extFromType(audio.contentType);
  const blob = new Blob([audio.body], { type: audio.contentType || 'audio/mpeg' });
  const models = Array.from(
    new Set([OPENAI_TRANSCRIBE_MODEL, 'gpt-4o-mini-transcribe', 'whisper-1'].filter(Boolean)),
  );

  let lastErr = '';
  for (const model of models) {
    try {
      const form = new FormData();
      form.append('model', model);
      form.append('file', blob, `call.${ext}`);
      const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
        body: form,
      });
      if (!res.ok) {
        lastErr = `Transcription failed (${model}): ${res.status}`;
        continue;
      }
      const json = await res.json();
      const text = String(json?.text || '').replace(/\s+/g, ' ').trim();
      if (text) return { text };
      lastErr = `Empty transcript (${model})`;
    } catch (e: any) {
      lastErr = e?.message || `Transcription error (${model})`;
    }
  }
  return { text: null, warning: lastErr || 'Transcription failed' };
}

export async function attachTranscriptToSopInput(
  input: AnalyzeSopInput,
  recordingUrl?: string | null,
  existingTranscript?: string | null,
): Promise<{ input: AnalyzeSopInput; warning?: string }> {
  const cached = String(existingTranscript || input.call_transcript || '').replace(/\s+/g, ' ').trim();
  if (cached.length >= 8) {
    return { input: { ...input, call_transcript: cached } };
  }
  const url = String(recordingUrl || input.call_recording_url || '').trim();
  if (!url) return { input, warning: 'No recording to transcribe' };
  const result = await transcribeCallRecording(url);
  if (!result.text) return { input, warning: result.warning };
  return { input: { ...input, call_transcript: result.text } };
}
