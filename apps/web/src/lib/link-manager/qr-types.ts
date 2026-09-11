export type QrStyleOptions = {
  dark_color?: string;
  light_color?: string;
  use_gradient?: boolean;
  gradient_from?: string;
  gradient_to?: string;
  gradient_angle?: number;
  margin?: number;
  error_correction?: 'L' | 'M' | 'Q' | 'H' | 'auto';
  logo_data_url?: string | null;
  logo_url?: string | null;
  logo_size_percent?: number;
  preset?: string;
};

export const QR_COLOR_PRESETS = [
  { id: 'myfng', label: 'MyFNG Blue', dark: '#023D95', light: '#FFFFFF' },
  { id: 'classic', label: 'Classic', dark: '#000000', light: '#FFFFFF' },
  { id: 'indigo', label: 'Indigo', dark: '#4338CA', light: '#EEF2FF' },
  { id: 'emerald', label: 'Emerald', dark: '#047857', light: '#ECFDF5' },
  { id: 'slate', label: 'Dark', dark: '#1E293B', light: '#F8FAFC' },
] as const;

export const QR_GRADIENT_PRESETS = [
  { id: 'blue-purple', label: 'Blue → Purple', from: '#023D95', to: '#7C3AED' },
  { id: 'ocean', label: 'Ocean', from: '#0369A1', to: '#22D3EE' },
  { id: 'sunset', label: 'Sunset', from: '#EA580C', to: '#E11D48' },
  { id: 'forest', label: 'Forest', from: '#047857', to: '#84CC16' },
] as const;

export const DEFAULT_QR_STYLE: QrStyleOptions = {
  dark_color: '#023D95',
  light_color: '#FFFFFF',
  use_gradient: false,
  gradient_from: '#023D95',
  gradient_to: '#7C3AED',
  gradient_angle: 135,
  margin: 2,
  error_correction: 'auto',
  logo_size_percent: 22,
  preset: 'myfng',
};

export function qrStylePreviewKey(style?: QrStyleOptions | null) {
  const s = normalizeQrStyle(style);
  return [
    s.dark_color,
    s.light_color,
    s.use_gradient ? '1' : '0',
    s.gradient_from,
    s.gradient_to,
    s.gradient_angle,
    s.margin,
    s.error_correction,
    s.logo_size_percent,
    s.logo_url || '',
    s.logo_data_url ? s.logo_data_url.slice(0, 48) : '',
  ].join('|');
}

export const MYFNG_LOGO_URL = '/favicon-32x32.png';

export function normalizeQrStyle(raw?: QrStyleOptions | null): QrStyleOptions {
  const base = { ...DEFAULT_QR_STYLE, ...(raw || {}) };
  if (base.error_correction === 'auto') {
    base.error_correction = base.logo_data_url || base.logo_url ? 'H' : 'M';
  }
  return base;
}

export function resolveErrorCorrection(style: QrStyleOptions): 'L' | 'M' | 'Q' | 'H' {
  if (style.logo_data_url || style.logo_url) return 'H';
  const level = style.error_correction;
  if (level === 'auto' || !level) return 'M';
  return level;
}

export function parseHexRgb(hex: string) {
  const clean = String(hex || '').replace('#', '').trim();
  if (clean.length === 3) {
    return {
      r: parseInt(clean[0] + clean[0], 16),
      g: parseInt(clean[1] + clean[1], 16),
      b: parseInt(clean[2] + clean[2], 16),
    };
  }
  if (clean.length >= 6) {
    return {
      r: parseInt(clean.slice(0, 2), 16),
      g: parseInt(clean.slice(2, 4), 16),
      b: parseInt(clean.slice(4, 6), 16),
    };
  }
  return { r: 0, g: 0, b: 0 };
}

export function lerpHex(from: string, to: string, t: number) {
  const a = parseHexRgb(from);
  const b = parseHexRgb(to);
  const k = Math.min(1, Math.max(0, t));
  const hex = (n: number) => Math.round(n).toString(16).padStart(2, '0');
  return `#${hex(a.r + (b.r - a.r) * k)}${hex(a.g + (b.g - a.g) * k)}${hex(a.b + (b.b - a.b) * k)}`;
}

export function gradientStop(x: number, y: number, size: number, angleDeg = 135) {
  const rad = (Number(angleDeg) * Math.PI) / 180;
  const cx = (x / Math.max(1, size) - 0.5) * Math.cos(rad) + (y / Math.max(1, size) - 0.5) * Math.sin(rad);
  return Math.min(1, Math.max(0, cx + 0.5));
}

export function isDarkQrModule(r: number, g: number, b: number, a = 255) {
  if (a < 40) return false;
  return (r + g + b) / 3 < 140;
}
