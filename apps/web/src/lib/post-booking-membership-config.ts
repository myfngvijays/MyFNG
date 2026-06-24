import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export type PostBookingMembershipSurfaces = {
  show_on_home: boolean;
  show_on_account: boolean;
  show_on_order_history: boolean;
  show_on_booking_success: boolean;
};

export type PostBookingMembershipConfig = {
  enabled: boolean;
  offer_window_minutes: number;
  bundle_discount_percent: number;
  bundle_discount_max_inr: number;
  card_title: string;
  fomo_message: string;
} & PostBookingMembershipSurfaces;

export type PostBookingMembershipAppConfig = Pick<
  PostBookingMembershipConfig,
  'enabled' | 'offer_window_minutes' | 'card_title' | 'fomo_message' | keyof PostBookingMembershipSurfaces
>;

export const DEFAULT_POST_BOOKING_MEMBERSHIP_CARD_TITLE = 'Keep your booking discount';
export const DEFAULT_POST_BOOKING_MEMBERSHIP_FOMO_MESSAGE =
  'Activate Prime before the timer ends - or your special booking price will be removed.';

export const DEFAULT_POST_BOOKING_MEMBERSHIP_CONFIG: PostBookingMembershipConfig = {
  enabled: true,
  offer_window_minutes: 180,
  bundle_discount_percent: 5,
  bundle_discount_max_inr: 250,
  card_title: DEFAULT_POST_BOOKING_MEMBERSHIP_CARD_TITLE,
  fomo_message: DEFAULT_POST_BOOKING_MEMBERSHIP_FOMO_MESSAGE,
  show_on_home: true,
  show_on_account: true,
  show_on_order_history: true,
  show_on_booking_success: true,
};

const SETTING_KEYS = {
  enabled: 'post_booking_membership_enabled',
  offer_window_minutes: 'post_booking_membership_offer_window_minutes',
  offer_hours_legacy: 'post_booking_membership_offer_hours',
  bundle_discount_percent: 'post_booking_membership_bundle_percent',
  bundle_discount_max_inr: 'post_booking_membership_bundle_max_inr',
  card_title: 'post_booking_membership_card_title',
  fomo_message: 'post_booking_membership_fomo_message',
  show_on_home: 'post_booking_membership_show_home',
  show_on_account: 'post_booking_membership_show_account',
  show_on_order_history: 'post_booking_membership_show_order_history',
  show_on_booking_success: 'post_booking_membership_show_booking_success',
} as const;

let cached:
  | {
      value: PostBookingMembershipConfig;
      expiresAt: number;
    }
  | null = null;

function toBool(value: unknown, fallback: boolean): boolean {
  if (value === undefined || value === null || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function toNumber(value: unknown, fallback: number, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function toText(value: unknown, fallback: string, maxLen: number): string {
  const text = String(value ?? '').trim();
  if (!text) return fallback;
  return text.slice(0, maxLen);
}

export function clearPostBookingMembershipConfigCache() {
  cached = null;
}

export const MAX_OFFER_WINDOW_MINUTES = 72 * 60;

export function splitOfferWindowMinutes(totalMinutes: number): { hours: number; minutes: number } {
  const safe = toNumber(totalMinutes, DEFAULT_POST_BOOKING_MEMBERSHIP_CONFIG.offer_window_minutes, 1, MAX_OFFER_WINDOW_MINUTES);
  return { hours: Math.floor(safe / 60), minutes: safe % 60 };
}

export function combineOfferWindowMinutes(hours: number, minutes: number): number {
  return toNumber(hours * 60 + minutes, DEFAULT_POST_BOOKING_MEMBERSHIP_CONFIG.offer_window_minutes, 1, MAX_OFFER_WINDOW_MINUTES);
}

export function formatOfferWindowLabel(totalMinutes: number): string {
  const { hours, minutes } = splitOfferWindowMinutes(totalMinutes);
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
}

function resolveOfferWindowMinutes(input?: Partial<PostBookingMembershipConfig> | null, map?: Map<string, string>): number {
  const base = DEFAULT_POST_BOOKING_MEMBERSHIP_CONFIG.offer_window_minutes;
  if (input?.offer_window_minutes != null) {
    return toNumber(input.offer_window_minutes, base, 1, MAX_OFFER_WINDOW_MINUTES);
  }
  if (input && 'offer_hours' in input && input.offer_hours != null) {
    return toNumber(Number(input.offer_hours) * 60, base, 1, MAX_OFFER_WINDOW_MINUTES);
  }
  if (map?.has(SETTING_KEYS.offer_window_minutes)) {
    return toNumber(map.get(SETTING_KEYS.offer_window_minutes), base, 1, MAX_OFFER_WINDOW_MINUTES);
  }
  if (map?.has(SETTING_KEYS.offer_hours_legacy)) {
    return toNumber(Number(map.get(SETTING_KEYS.offer_hours_legacy)) * 60, base, 1, MAX_OFFER_WINDOW_MINUTES);
  }
  return base;
}

export function normalizePostBookingMembershipConfig(
  input?: Partial<PostBookingMembershipConfig> & { offer_hours?: number } | null,
): PostBookingMembershipConfig {
  const base = DEFAULT_POST_BOOKING_MEMBERSHIP_CONFIG;
  return {
    enabled: input?.enabled ?? base.enabled,
    offer_window_minutes: resolveOfferWindowMinutes(input),
    bundle_discount_percent: toNumber(input?.bundle_discount_percent, base.bundle_discount_percent, 1, 50),
    bundle_discount_max_inr: toNumber(input?.bundle_discount_max_inr, base.bundle_discount_max_inr, 1, 5000),
    card_title: toText(input?.card_title, base.card_title, 120),
    fomo_message: toText(input?.fomo_message, base.fomo_message, 280),
    show_on_home: input?.show_on_home ?? base.show_on_home,
    show_on_account: input?.show_on_account ?? base.show_on_account,
    show_on_order_history: input?.show_on_order_history ?? base.show_on_order_history,
    show_on_booking_success: input?.show_on_booking_success ?? base.show_on_booking_success,
  };
}

export function toPostBookingMembershipAppConfig(
  config: PostBookingMembershipConfig,
): PostBookingMembershipAppConfig {
  return {
    enabled: config.enabled,
    offer_window_minutes: config.offer_window_minutes,
    card_title: config.card_title,
    fomo_message: config.fomo_message,
    show_on_home: config.show_on_home,
    show_on_account: config.show_on_account,
    show_on_order_history: config.show_on_order_history,
    show_on_booking_success: config.show_on_booking_success,
  };
}

function readConfigFromMap(map: Map<string, string>): PostBookingMembershipConfig {
  const base = DEFAULT_POST_BOOKING_MEMBERSHIP_CONFIG;
  return normalizePostBookingMembershipConfig({
    enabled: toBool(map.get(SETTING_KEYS.enabled), base.enabled),
    offer_window_minutes: resolveOfferWindowMinutes(null, map),
    bundle_discount_percent: toNumber(
      map.get(SETTING_KEYS.bundle_discount_percent),
      base.bundle_discount_percent,
      1,
      50,
    ),
    bundle_discount_max_inr: toNumber(
      map.get(SETTING_KEYS.bundle_discount_max_inr),
      base.bundle_discount_max_inr,
      1,
      5000,
    ),
    card_title: toText(map.get(SETTING_KEYS.card_title), base.card_title, 120),
    fomo_message: toText(map.get(SETTING_KEYS.fomo_message), base.fomo_message, 280),
    show_on_home: toBool(map.get(SETTING_KEYS.show_on_home), base.show_on_home),
    show_on_account: toBool(map.get(SETTING_KEYS.show_on_account), base.show_on_account),
    show_on_order_history: toBool(map.get(SETTING_KEYS.show_on_order_history), base.show_on_order_history),
    show_on_booking_success: toBool(map.get(SETTING_KEYS.show_on_booking_success), base.show_on_booking_success),
  });
}

export async function getPostBookingMembershipConfig(
  supabaseAdmin?: any,
): Promise<PostBookingMembershipConfig> {
  if (cached && Date.now() < cached.expiresAt) return cached.value;

  const admin = supabaseAdmin || getSupabaseAdmin().supabaseAdmin;
  if (!admin) {
    cached = { value: DEFAULT_POST_BOOKING_MEMBERSHIP_CONFIG, expiresAt: Date.now() + 30_000 };
    return cached.value;
  }

  const { data } = await admin
    .from('system_settings')
    .select('setting_key, setting_value')
    .in('setting_key', Object.values(SETTING_KEYS));

  const map = new Map((data || []).map((row: any) => [String(row.setting_key), String(row.setting_value)]));
  const value = readConfigFromMap(map);

  cached = { value, expiresAt: Date.now() + 30_000 };
  return value;
}

async function upsertSetting(
  supabaseAdmin: any,
  key: string,
  value: string,
  type: 'BOOLEAN' | 'NUMBER' | 'STRING',
  updatedBy?: string | null,
) {
  const { error } = await supabaseAdmin.from('system_settings').upsert(
    {
      setting_key: key,
      setting_value: value,
      setting_type: type,
      category: 'MEMBERSHIP',
      description: 'Post-booking Prime membership offer',
      updated_by: updatedBy || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'setting_key' },
  );
  if (error) throw new Error(error.message || `Could not save ${key}`);
}

export async function savePostBookingMembershipConfig(
  supabaseAdmin: any,
  input: Partial<PostBookingMembershipConfig>,
  updatedBy?: string | null,
): Promise<PostBookingMembershipConfig> {
  const next = normalizePostBookingMembershipConfig(input);

  await upsertSetting(supabaseAdmin, SETTING_KEYS.enabled, String(next.enabled), 'BOOLEAN', updatedBy);
  await upsertSetting(
    supabaseAdmin,
    SETTING_KEYS.offer_window_minutes,
    String(next.offer_window_minutes),
    'NUMBER',
    updatedBy,
  );
  await upsertSetting(
    supabaseAdmin,
    SETTING_KEYS.bundle_discount_percent,
    String(next.bundle_discount_percent),
    'NUMBER',
    updatedBy,
  );
  await upsertSetting(
    supabaseAdmin,
    SETTING_KEYS.bundle_discount_max_inr,
    String(next.bundle_discount_max_inr),
    'NUMBER',
    updatedBy,
  );
  await upsertSetting(supabaseAdmin, SETTING_KEYS.card_title, next.card_title, 'STRING', updatedBy);
  await upsertSetting(supabaseAdmin, SETTING_KEYS.fomo_message, next.fomo_message, 'STRING', updatedBy);
  await upsertSetting(supabaseAdmin, SETTING_KEYS.show_on_home, String(next.show_on_home), 'BOOLEAN', updatedBy);
  await upsertSetting(supabaseAdmin, SETTING_KEYS.show_on_account, String(next.show_on_account), 'BOOLEAN', updatedBy);
  await upsertSetting(
    supabaseAdmin,
    SETTING_KEYS.show_on_order_history,
    String(next.show_on_order_history),
    'BOOLEAN',
    updatedBy,
  );
  await upsertSetting(
    supabaseAdmin,
    SETTING_KEYS.show_on_booking_success,
    String(next.show_on_booking_success),
    'BOOLEAN',
    updatedBy,
  );

  clearPostBookingMembershipConfigCache();
  return next;
}

export function calculateBundleDiscountWithConfig(
  serviceSubtotal: number,
  config: PostBookingMembershipConfig = DEFAULT_POST_BOOKING_MEMBERSHIP_CONFIG,
): number {
  if (serviceSubtotal <= 0) return 0;
  const raw = serviceSubtotal * (config.bundle_discount_percent / 100);
  return Math.min(Math.round(raw), config.bundle_discount_max_inr);
}

export function filterPostBookingMembershipAdminRows<T extends {
  lead_number: string;
  customer_name: string;
  customer_phone: string;
  vehicle_number: string;
}>(rows: T[], query?: string | null): T[] {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return rows;
  const digits = q.replace(/\D/g, '');
  return rows.filter((row) => {
    const haystack = [
      row.lead_number,
      row.customer_name,
      row.customer_phone,
      row.vehicle_number,
    ]
      .join(' ')
      .toLowerCase();
    if (haystack.includes(q)) return true;
    if (digits.length >= 4) {
      return String(row.customer_phone || '').replace(/\D/g, '').includes(digits);
    }
    return false;
  });
}

export function buildPostBookingMembershipAdminStats(rows: Array<{ offer_status: string }>) {
  const active = rows.filter((row) => row.offer_status === 'active').length;
  const expired = rows.filter((row) => row.offer_status === 'expired').length;
  const paid = rows.filter((row) => row.offer_status === 'paid').length;
  const revoked = rows.filter((row) => row.offer_status === 'revoked').length;
  const closed = paid + expired + revoked;
  const conversion_rate = closed > 0 ? Math.round((paid / closed) * 1000) / 10 : 0;
  return { active, expired, paid, revoked, total: rows.length, conversion_rate };
}
