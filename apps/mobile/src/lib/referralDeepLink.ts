import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const REFERRAL_CODE_KEY = 'pending_referral_code';

export async function storeReferralCode(code: string): Promise<void> {
  try {
    await AsyncStorage.setItem(REFERRAL_CODE_KEY, code);
  } catch (_) {}
}

export async function getPendingReferralCode(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(REFERRAL_CODE_KEY);
  } catch (_) {
    return null;
  }
}

export async function clearPendingReferralCode(): Promise<void> {
  try {
    await AsyncStorage.removeItem(REFERRAL_CODE_KEY);
  } catch (_) {}
}

/**
 * Check Play Store install referrer (Android only).
 */
export async function checkPlayStoreReferrer(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    const Application = require('expo-application');
    const referrer: string | null = await Application.getInstallReferrerAsync();
    if (!referrer) return;
    const match = referrer.match(/referral_code=([A-Za-z0-9]+)/);
    if (match?.[1]) {
      const existing = await getPendingReferralCode();
      if (!existing) {
        await storeReferralCode(match[1]);
      }
    }
  } catch (_) {}
}
