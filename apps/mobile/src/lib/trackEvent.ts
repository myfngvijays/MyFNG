import { NativeModules, Platform } from 'react-native';

type AnalyticsModule = typeof import('@react-native-firebase/analytics').default;

let analyticsModule: AnalyticsModule | null | undefined;

function getAnalytics(): AnalyticsModule | null {
  if (analyticsModule !== undefined) return analyticsModule;
  if (Platform.OS === 'web' || !NativeModules.RNFBAnalyticsModule) {
    analyticsModule = null;
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    analyticsModule = require('@react-native-firebase/analytics').default as AnalyticsModule;
    return analyticsModule;
  } catch {
    analyticsModule = null;
    return null;
  }
}

export function trackEvent(name: string, params?: Record<string, string | number | boolean>): void {
  if (Platform.OS === 'web') return;
  const analytics = getAnalytics();
  if (!analytics) return;
  try {
    void analytics().logEvent(name, params || {});
  } catch {
    // Silently fail if native module unavailable
  }
}

export function trackScreen(screenName: string): void {
  if (Platform.OS === 'web' || !screenName.trim()) return;
  const analytics = getAnalytics();
  if (!analytics) return;
  try {
    void analytics().logScreenView({ screen_name: screenName, screen_class: screenName });
  } catch {
    // Silently fail
  }
}

export function setUserProperty(key: string, value: string | null): void {
  if (Platform.OS === 'web') return;
  const analytics = getAnalytics();
  if (!analytics) return;
  try {
    void analytics().setUserProperty(key, value);
  } catch {
    // Silently fail
  }
}

export function setUserId(userId: string | null): void {
  if (Platform.OS === 'web') return;
  const analytics = getAnalytics();
  if (!analytics) return;
  try {
    void analytics().setUserId(userId);
  } catch {
    // Silently fail
  }
}
