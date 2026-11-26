import * as FileSystem from 'expo-file-system';

export type CrmNewLeadSoundId = 'bright' | 'soft' | 'double' | 'chime';

export const CRM_NEW_LEAD_SOUND_OPTIONS: Array<{
  id: CrmNewLeadSoundId;
  label: string;
  hint: string;
}> = [
  { id: 'bright', label: 'Bright ding', hint: 'Tez single tone — default CRM alert' },
  { id: 'soft', label: 'Soft ping', hint: 'Halka, kam volume — busy floor ke liye' },
  { id: 'double', label: 'Double beep', hint: 'Do short beeps — attention grab' },
  { id: 'chime', label: '3-note chime', hint: 'Upar ki taraf teen notes — premium feel' },
];

function encodeWavMono16(pcm: Int16Array, rate: number): string {
  const dataLen = pcm.length * 2;
  const buf = new ArrayBuffer(44 + dataLen);
  const view = new DataView(buf);
  const writeStr = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataLen, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataLen, true);
  let offset = 44;
  for (let i = 0; i < pcm.length; i++) {
    view.setInt16(offset, pcm[i], true);
    offset += 2;
  }
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function synthTone(
  rate: number,
  durationSec: number,
  freq: number,
  volume = 0.55,
  decay = 5.5,
): Int16Array {
  const n = Math.floor(rate * durationSec);
  const pcm = new Int16Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const env = Math.exp(-t * decay);
    const s = Math.sin(2 * Math.PI * freq * t) * env * volume;
    pcm[i] = (Math.max(-1, Math.min(1, s)) * 28000) | 0;
  }
  return pcm;
}

function concat(...chunks: Int16Array[]): Int16Array {
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Int16Array(total);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

function silence(rate: number, ms: number): Int16Array {
  return new Int16Array(Math.floor((rate * ms) / 1000));
}

function wavBase64ForSound(id: CrmNewLeadSoundId): string {
  const rate = 16000;
  let pcm: Int16Array;
  switch (id) {
    case 'soft':
      pcm = synthTone(rate, 0.28, 520, 0.5, 6.5);
      break;
    case 'double':
      pcm = concat(
        synthTone(rate, 0.14, 784, 0.5, 8),
        silence(rate, 70),
        synthTone(rate, 0.16, 880, 0.55, 7),
      );
      break;
    case 'chime':
      pcm = concat(
        synthTone(rate, 0.12, 659, 0.42, 9),
        silence(rate, 35),
        synthTone(rate, 0.12, 784, 0.45, 9),
        silence(rate, 35),
        synthTone(rate, 0.18, 988, 0.5, 6),
      );
      break;
    case 'bright':
    default:
      pcm = concat(
        synthTone(rate, 0.16, 740, 0.52, 8),
        synthTone(rate, 0.2, 988, 0.4, 5.5),
      );
      break;
  }
  return encodeWavMono16(pcm, rate);
}

const cacheUri: Partial<Record<CrmNewLeadSoundId, Promise<string>>> = {};
let activePlayer: { play: () => void; remove?: () => void } | null = null;

async function uriForSound(id: CrmNewLeadSoundId): Promise<string> {
  if (!cacheUri[id]) {
    cacheUri[id] = (async () => {
      const uri = `${FileSystem.cacheDirectory}crm-new-lead-${id}.wav`;
      const info = await FileSystem.getInfoAsync(uri);
      if (!info.exists) {
        await FileSystem.writeAsStringAsync(uri, wavBase64ForSound(id), {
          encoding: FileSystem.EncodingType.Base64,
        });
      }
      return uri;
    })();
  }
  return cacheUri[id]!;
}

export async function playCrmNewLeadSound(id: CrmNewLeadSoundId): Promise<void> {
  try {
    const audio = (await import('expo-audio')) as {
      setAudioModeAsync?: (o: {
        playsInSilentMode?: boolean;
        interruptionMode?: string;
        interruptionModeAndroid?: string;
      }) => Promise<void>;
      createAudioPlayer: (source: { uri: string }) => { play: () => void; remove?: () => void };
    };
    await audio.setAudioModeAsync?.({
      playsInSilentMode: true,
      interruptionMode: 'mixWithOthers',
      interruptionModeAndroid: 'duckOthers',
    });
    const uri = await uriForSound(id);
    activePlayer?.remove?.();
    const player = audio.createAudioPlayer({ uri });
    activePlayer = player;
    player.play();
  } catch {
    /* optional */
  }
}