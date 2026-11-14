export const UI_FONT_STORAGE_KEY = 'myfng_ui_font_px';
export const UI_FONT_MIN = 12;
export const UI_FONT_MAX = 22;
export const UI_FONT_DEFAULT = 16;

export function clampUiFontPx(value: number): number {
  if (!Number.isFinite(value)) return UI_FONT_DEFAULT;
  return Math.min(UI_FONT_MAX, Math.max(UI_FONT_MIN, Math.round(value)));
}

export function readUiFontPx(): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(UI_FONT_STORAGE_KEY);
    if (!raw) return null;
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    return clampUiFontPx(n);
  } catch {
    return null;
  }
}

/** Null clears the override and returns the dashboard to its normal size. */
export function applyUiFontPx(px: number | null) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (px == null) {
    root.style.removeProperty('font-size');
    return;
  }
  root.style.fontSize = `${clampUiFontPx(px)}px`;
}

export function saveUiFontPx(px: number | null) {
  if (typeof window === 'undefined') return;
  try {
    if (px == null) window.localStorage.removeItem(UI_FONT_STORAGE_KEY);
    else window.localStorage.setItem(UI_FONT_STORAGE_KEY, String(clampUiFontPx(px)));
  } catch {
    /* ignore */
  }
  applyUiFontPx(px);
}
