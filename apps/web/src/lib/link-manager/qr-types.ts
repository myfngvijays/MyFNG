export type QrStyleOptions = {
  dark_color?: string;
  light_color?: string;
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

export const DEFAULT_QR_STYLE: QrStyleOptions = {
  dark_color: '#023D95',
  light_color: '#FFFFFF',
  margin: 2,
  error_correction: 'auto',
  logo_size_percent: 22,
  preset: 'myfng',
};

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
