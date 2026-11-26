export type CrmNewLeadSoundId = 'bright' | 'soft' | 'double' | 'chime';

export const CRM_NEW_LEAD_SOUND_OPTIONS: Array<{
  id: CrmNewLeadSoundId;
  label: string;
  hint: string;
}> = [
  { id: 'bright', label: 'Bright ding', hint: 'Tez single tone' },
  { id: 'soft', label: 'Soft ping', hint: 'Halka volume' },
  { id: 'double', label: 'Double beep', hint: 'Do short beeps' },
  { id: 'chime', label: '3-note chime', hint: 'Teen ascending notes' },
];

function tone(
  ctx: AudioContext,
  when: number,
  freq: number,
  duration: number,
  gain = 0.12,
) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(gain, when + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, when + duration);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(when);
  osc.stop(when + duration + 0.05);
}

export function playCrmNewLeadWebSound(id: CrmNewLeadSoundId): void {
  if (typeof window === 'undefined') return;
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const t0 = ctx.currentTime + 0.02;
    switch (id) {
      case 'soft':
        tone(ctx, t0, 520, 0.28, 0.1);
        break;
      case 'double':
        tone(ctx, t0, 784, 0.14, 0.11);
        tone(ctx, t0 + 0.2, 880, 0.16, 0.12);
        break;
      case 'chime':
        tone(ctx, t0, 659, 0.12, 0.09);
        tone(ctx, t0 + 0.16, 784, 0.12, 0.1);
        tone(ctx, t0 + 0.32, 988, 0.18, 0.11);
        break;
      case 'bright':
      default:
        tone(ctx, t0, 740, 0.16, 0.11);
        tone(ctx, t0 + 0.12, 988, 0.2, 0.1);
        break;
    }
    window.setTimeout(() => void ctx.close(), 800);
  } catch {
    /* ignore */
  }
}