/**
 * Small sound effects for the customer "garage" login.
 * Files come from scripts/generate-login-sounds.py (assets/sounds/*.wav).
 *
 * - Respects the phone's silent switch (no sound when silent).
 * - Mixes with music the customer is already playing instead of stopping it.
 * - Never throws: if audio is unavailable the login just stays quiet.
 */
import { Vibration } from 'react-native';

export type LoginSound = 'ignition' | 'tick' | 'stall' | 'engine';

const SOURCES: Record<LoginSound, number> = {
  ignition: require('../../assets/sounds/ignition.wav'),
  tick: require('../../assets/sounds/tick.wav'),
  stall: require('../../assets/sounds/stall.wav'),
  engine: require('../../assets/sounds/engine.wav'),
};

type Player = { play: () => void; seekTo: (s: number) => Promise<void>; volume: number; remove: () => void };

const players: Partial<Record<LoginSound, Player>> = {};
let audioReady: Promise<boolean> | null = null;

function loadAudio(): Promise<boolean> {
  if (audioReady) return audioReady;
  audioReady = (async () => {
    try {
      const audio = require('expo-audio');
      await audio.setAudioModeAsync({
        playsInSilentMode: false,
        interruptionMode: 'mixWithOthers',
        interruptionModeAndroid: 'duckOthers',
      });
      (Object.keys(SOURCES) as LoginSound[]).forEach((key) => {
        const p = audio.createAudioPlayer(SOURCES[key]) as Player;
        p.volume = key === 'tick' ? 0.45 : 0.8;
        players[key] = p;
      });
      return true;
    } catch {
      return false;
    }
  })();
  return audioReady;
}

/** Load the players early (e.g. when the login screen opens) so the first sound is instant. */
export function preloadLoginSounds(): void {
  void loadAudio();
}

export function playLoginSound(sound: LoginSound): void {
  void (async () => {
    if (!(await loadAudio())) return;
    const p = players[sound];
    if (!p) return;
    try {
      await p.seekTo(0);
      p.play();
    } catch {
      /* stay quiet */
    }
  })();
  // A short buzz on a wrong OTP is felt even in silent mode.
  if (sound === 'stall') Vibration.vibrate(120);
}

/** Free the players when the login flow is done. */
export function releaseLoginSounds(): void {
  (Object.keys(players) as LoginSound[]).forEach((key) => {
    try {
      players[key]?.remove();
    } catch {
      /* ignore */
    }
    delete players[key];
  });
  audioReady = null;
}
