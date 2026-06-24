import { ENV } from '../config/environment';
import {
  DEFAULT_POST_BOOKING_MEMBERSHIP_CARD_TITLE,
  DEFAULT_POST_BOOKING_MEMBERSHIP_FOMO_MESSAGE,
  POST_BOOKING_MEMBERSHIP_OFFER_MINUTES,
} from './postBookingMembershipOffer';

export type PostBookingMembershipAppConfig = {
  enabled: boolean;
  offer_window_minutes: number;
  card_title: string;
  fomo_message: string;
  show_on_home: boolean;
  show_on_account: boolean;
  show_on_order_history: boolean;
  show_on_booking_success: boolean;
};

export const DEFAULT_POST_BOOKING_MEMBERSHIP_APP_CONFIG: PostBookingMembershipAppConfig = {
  enabled: true,
  offer_window_minutes: POST_BOOKING_MEMBERSHIP_OFFER_MINUTES,
  card_title: DEFAULT_POST_BOOKING_MEMBERSHIP_CARD_TITLE,
  fomo_message: DEFAULT_POST_BOOKING_MEMBERSHIP_FOMO_MESSAGE,
  show_on_home: true,
  show_on_account: true,
  show_on_order_history: true,
  show_on_booking_success: true,
};

let cached: PostBookingMembershipAppConfig | null = null;
let cachedAt = 0;
let inflight: Promise<PostBookingMembershipAppConfig> | null = null;

function normalizeConfig(raw: any): PostBookingMembershipAppConfig {
  const base = DEFAULT_POST_BOOKING_MEMBERSHIP_APP_CONFIG;
  const minutes = Number(raw?.offer_window_minutes);
  return {
    enabled: raw?.enabled !== false,
    offer_window_minutes:
      Number.isFinite(minutes) && minutes >= 1 ? Math.round(minutes) : base.offer_window_minutes,
    card_title: String(raw?.card_title || base.card_title).trim() || base.card_title,
    fomo_message: String(raw?.fomo_message || base.fomo_message).trim() || base.fomo_message,
    show_on_home: raw?.show_on_home !== false,
    show_on_account: raw?.show_on_account !== false,
    show_on_order_history: raw?.show_on_order_history !== false,
    show_on_booking_success: raw?.show_on_booking_success !== false,
  };
}

export function invalidatePostBookingMembershipAppConfigCache() {
  cached = null;
  cachedAt = 0;
  inflight = null;
}

export async function fetchPostBookingMembershipAppConfig(
  force = false,
): Promise<PostBookingMembershipAppConfig> {
  if (!force && cached && Date.now() - cachedAt < 60_000) return cached;
  if (!force && inflight) return inflight;

  inflight = fetch(`${ENV.API_URL}/api/public/post-booking-membership/config`, { cache: 'no-store' })
    .then(async (res) => {
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return DEFAULT_POST_BOOKING_MEMBERSHIP_APP_CONFIG;
      return normalizeConfig(json?.config);
    })
    .catch(() => DEFAULT_POST_BOOKING_MEMBERSHIP_APP_CONFIG)
    .then((value) => {
      cached = value;
      cachedAt = Date.now();
      inflight = null;
      return value;
    });

  return inflight;
}

export function mergePostBookingMembershipAppConfig(
  partial?: Partial<PostBookingMembershipAppConfig> | null,
): PostBookingMembershipAppConfig {
  if (!partial) return DEFAULT_POST_BOOKING_MEMBERSHIP_APP_CONFIG;
  return normalizeConfig({ ...DEFAULT_POST_BOOKING_MEMBERSHIP_APP_CONFIG, ...partial });
}
