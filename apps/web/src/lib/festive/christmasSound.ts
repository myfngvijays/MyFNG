const CLIP_SRC = '/sounds/jingle-bells.mp3';
/** First N seconds of the track only. */
const CLIP_SECONDS = 10;
/** Replay interval when festive sound is on. */
const LOOP_MS = 3 * 60 * 1000;

let loopTimer: ReturnType<typeof setInterval> | null = null;
let clipStopTimer: ReturnType<typeof setTimeout> | null = null;
let clip: HTMLAudioElement | null = null;

function clearClipStopTimer() {
  if (clipStopTimer) {
    clearTimeout(clipStopTimer);
    clipStopTimer = null;
  }
}

function ensureClip(): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!clip) {
      clip = new Audio(CLIP_SRC);
      clip.preload = 'auto';
    }
    return clip;
  } catch {
    return null;
  }
}

function scheduleClipStop(el: HTMLAudioElement) {
  clearClipStopTimer();
  clipStopTimer = setTimeout(() => {
    try {
      el.pause();
      el.currentTime = 0;
    } catch {
      /* ignore */
    }
    clipStopTimer = null;
  }, CLIP_SECONDS * 1000);
}

/** Plays the first 10s of jingle-bells.mp3. */
export function playChristmasBells(): Promise<boolean> {
  const el = ensureClip();
  if (!el) return Promise.resolve(false);
  try {
    el.volume = 0.5;
    el.currentTime = 0;
    scheduleClipStop(el);
    return el.play().then(() => true).catch(() => false);
  } catch {
    return Promise.resolve(false);
  }
}

export function startChristmasSoundLoop() {
  stopChristmasSoundLoop();
  void playChristmasBells();
  loopTimer = setInterval(() => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    void playChristmasBells();
  }, LOOP_MS);
}

export function stopChristmasSoundLoop() {
  if (loopTimer) {
    clearInterval(loopTimer);
    loopTimer = null;
  }
  clearClipStopTimer();
  if (clip) {
    try {
      clip.pause();
      clip.currentTime = 0;
    } catch {
      /* ignore */
    }
  }
}