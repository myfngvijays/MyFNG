import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export const SYSTEM_ALERT_WHATSAPP_NUMBERS_SETTING_KEY = 'system_alert_whatsapp_numbers';

export type SystemAlertWhatsAppNumber = {
  phone: string;
  enabled: boolean;
};

function normalizePhone(raw: string): string {
  return String(raw || '').replace(/\D/g, '');
}

function parseList(raw: unknown): SystemAlertWhatsAppNumber[] {
  if (!raw) return [];
  let value: unknown = raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      value = JSON.parse(trimmed);
    } catch {
      // Legacy comma-separated fallback
      return trimmed
        .split(',')
        .map((p) => normalizePhone(p))
        .filter(Boolean)
        .map((phone) => ({ phone, enabled: true }));
    }
  }
  if (!Array.isArray(value)) return [];
  const out: SystemAlertWhatsAppNumber[] = [];
  const seen = new Set<string>();
  for (const row of value) {
    const phone = normalizePhone(
      typeof row === 'string' ? row : String((row as { phone?: string })?.phone || ''),
    );
    if (!phone || seen.has(phone)) continue;
    seen.add(phone);
    const enabled =
      typeof row === 'object' && row && 'enabled' in row
        ? Boolean((row as { enabled?: boolean }).enabled)
        : true;
    out.push({ phone, enabled });
  }
  return out;
}

function envSeedList(): SystemAlertWhatsAppNumber[] {
  return (process.env.SYSTEM_ALERT_WHATSAPP_NUMBERS || '')
    .split(',')
    .map((v) => normalizePhone(v.trim()))
    .filter(Boolean)
    .map((phone) => ({ phone, enabled: true }));
}

async function readRawSetting(): Promise<string | null> {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return null;
  const { data } = await supabaseAdmin
    .from('system_settings')
    .select('setting_value')
    .eq('setting_key', SYSTEM_ALERT_WHATSAPP_NUMBERS_SETTING_KEY)
    .maybeSingle();
  return data?.setting_value != null ? String(data.setting_value) : null;
}

async function writeList(
  list: SystemAlertWhatsAppNumber[],
  updatedBy?: string | null,
): Promise<{ ok: true; numbers: SystemAlertWhatsAppNumber[] } | { ok: false; error: string }> {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return { ok: false, error: 'Database admin client unavailable' };

  const { error } = await supabaseAdmin.from('system_settings').upsert(
    {
      setting_key: SYSTEM_ALERT_WHATSAPP_NUMBERS_SETTING_KEY,
      setting_value: JSON.stringify(list),
      setting_type: 'JSON',
      category: 'NOTIFICATIONS',
      description:
        'Admin WhatsApp numbers for system health / admin alerts. JSON array of {phone, enabled}.',
      default_value: '[]',
      is_editable: true,
      updated_at: new Date().toISOString(),
      ...(updatedBy ? { updated_by: updatedBy } : {}),
    },
    { onConflict: 'setting_key' },
  );

  if (error) return { ok: false, error: error.message || 'Failed to save alert numbers' };
  return { ok: true, numbers: list };
}

/** List for admin UI. Seeds from env once when DB empty / []. */
export async function listSystemAlertWhatsAppNumbers(): Promise<SystemAlertWhatsAppNumber[]> {
  const raw = await readRawSetting();
  const parsed = parseList(raw);
  if (parsed.length > 0) return parsed;

  const seed = envSeedList();
  if (seed.length === 0) return [];

  const saved = await writeList(seed);
  return saved.ok ? saved.numbers : seed;
}

/** Only enabled phones — used by cron / alert senders. Falls back to env if DB empty. */
export async function getEnabledSystemAlertWhatsAppNumbers(): Promise<string[]> {
  const list = await listSystemAlertWhatsAppNumbers();
  const enabled = list.filter((n) => n.enabled).map((n) => n.phone);
  if (enabled.length > 0) return enabled;
  // If all toggled off intentionally, return empty (do not re-fall back to env)
  if (list.length > 0) return [];
  return envSeedList().map((n) => n.phone);
}

export async function setSystemAlertWhatsAppNumberEnabled(
  phone: string,
  enabled: boolean,
  updatedBy?: string | null,
): Promise<{ ok: true; numbers: SystemAlertWhatsAppNumber[] } | { ok: false; error: string }> {
  const normalized = normalizePhone(phone);
  if (!normalized || normalized.length < 10) {
    return { ok: false, error: 'Invalid phone number' };
  }
  const list = await listSystemAlertWhatsAppNumbers();
  const idx = list.findIndex((n) => n.phone === normalized);
  if (idx < 0) {
    list.push({ phone: normalized, enabled });
  } else {
    list[idx] = { ...list[idx], enabled };
  }
  return writeList(list, updatedBy);
}

export async function addSystemAlertWhatsAppNumber(
  phone: string,
  updatedBy?: string | null,
): Promise<{ ok: true; numbers: SystemAlertWhatsAppNumber[] } | { ok: false; error: string }> {
  const normalized = normalizePhone(phone);
  if (!normalized || normalized.length < 10) {
    return { ok: false, error: 'Invalid phone number (min 10 digits)' };
  }
  const list = await listSystemAlertWhatsAppNumbers();
  if (list.some((n) => n.phone === normalized)) {
    return { ok: false, error: 'Number already exists' };
  }
  list.push({ phone: normalized, enabled: true });
  return writeList(list, updatedBy);
}

export async function removeSystemAlertWhatsAppNumber(
  phone: string,
  updatedBy?: string | null,
): Promise<{ ok: true; numbers: SystemAlertWhatsAppNumber[] } | { ok: false; error: string }> {
  const normalized = normalizePhone(phone);
  const list = await listSystemAlertWhatsAppNumbers();
  const next = list.filter((n) => n.phone !== normalized);
  if (next.length === list.length) return { ok: false, error: 'Number not found' };
  return writeList(next, updatedBy);
}
