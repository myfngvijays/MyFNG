import AsyncStorage from '@react-native-async-storage/async-storage';

const CONSENT_KEY = 'myfng.background_location.consent.v1';

export async function hasBackgroundLocationConsent(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(CONSENT_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { accepted?: boolean };
    return parsed?.accepted === true;
  } catch {
    return false;
  }
}

export async function setBackgroundLocationConsent(accepted: boolean): Promise<void> {
  if (!accepted) {
    await AsyncStorage.removeItem(CONSENT_KEY);
    return;
  }
  await AsyncStorage.setItem(
    CONSENT_KEY,
    JSON.stringify({ accepted: true, at: new Date().toISOString() }),
  );
}
