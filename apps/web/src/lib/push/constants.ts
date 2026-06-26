/** Active mobile push platform (Firebase Cloud Messaging for Android + iOS). */
export const MOBILE_PUSH_PLATFORM = 'FCM';

/** Legacy Expo tokens — kept for queries during migration; no longer registered. */
export const LEGACY_EXPO_PUSH_PLATFORM = 'EXPO';

export const MOBILE_PUSH_PLATFORMS = [MOBILE_PUSH_PLATFORM, LEGACY_EXPO_PUSH_PLATFORM] as const;
