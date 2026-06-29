import { NativeModules, Platform } from 'react-native';

type AnalyticsModule = typeof import('@react-native-firebase/analytics').default;

let initialized = false;
let analyticsModule: AnalyticsModule | null | undefined;

function getAnalyticsModule(): AnalyticsModule | null {
  if (analyticsModule !== undefined) return analyticsModule;
  if (Platform.OS === 'web' || !NativeModules.RNFBAnalyticsModule) {
    if (__DEV__ && Platform.OS !== 'web' && !NativeModules.RNFBAnalyticsModule) {
      console.warn(
        '[Analytics] Native module not in this build. Rebuild the app after installing @react-native-firebase/analytics.',
      );
    }
    analyticsModule = null;
    return null;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    analyticsModule = require('@react-native-firebase/analytics').default as AnalyticsModule;
    return analyticsModule;
  } catch (error) {
    if (__DEV__) {
      console.warn('[Analytics] Failed to load module:', error);
    }
    analyticsModule = null;
    return null;
  }
}

/** Google Analytics for Firebase — Android + iOS native builds only. */
export async function initializeFirebaseAnalytics(): Promise<void> {
  if (initialized || Platform.OS === 'web') return;

  const analytics = getAnalyticsModule();
  if (!analytics) return;

  try {
    await analytics().setAnalyticsCollectionEnabled(true);
    await analytics().logAppOpen();
    await analytics().setUserProperty('app_platform', Platform.OS);
    initialized = true;
  } catch (error) {
    if (__DEV__) {
      console.warn('[Analytics] initialize failed:', error);
    }
  }
}

export async function logAnalyticsScreen(screenName: string): Promise<void> {
  if (Platform.OS === 'web' || !screenName.trim()) return;

  const analytics = getAnalyticsModule();
  if (!analytics) return;

  try {
    await analytics().logScreenView({
      screen_name: screenName,
      screen_class: screenName,
    });
  } catch {
    // Native module missing until app is rebuilt with analytics SDK.
  }
}
