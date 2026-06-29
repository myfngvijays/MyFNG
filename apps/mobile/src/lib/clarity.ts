import { NativeModules, Platform } from 'react-native';

const CLARITY_PROJECT_ID =
  process.env.EXPO_PUBLIC_CLARITY_PROJECT_ID?.trim() || 'x0kwaiy8aa';

let initialized = false;
let clarityModule: typeof import('@microsoft/react-native-clarity') | null | undefined;

function isClarityNativeLinked(): boolean {
  return Boolean(NativeModules.Clarity && NativeModules.ClarityEmitter);
}

function getClarityModule(): typeof import('@microsoft/react-native-clarity') | null {
  if (clarityModule !== undefined) return clarityModule;
  if (Platform.OS === 'web' || !isClarityNativeLinked()) {
    if (__DEV__ && Platform.OS !== 'web' && !isClarityNativeLinked()) {
      console.warn(
        '[Clarity] Native module not in this build. Rebuild with: cd apps/mobile && npx expo run:ios (or run:android). Expo Go is not supported.',
      );
    }
    clarityModule = null;
    return null;
  }

  try {
    // Lazy require — top-level import crashes when native modules are missing.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    clarityModule = require('@microsoft/react-native-clarity') as typeof import('@microsoft/react-native-clarity');
    return clarityModule;
  } catch (error) {
    if (__DEV__) {
      console.warn('[Clarity] Failed to load module:', error);
    }
    clarityModule = null;
    return null;
  }
}

/** Microsoft Clarity — session replay & heatmaps (Android + iOS native builds only). */
export function initializeClarity(): void {
  if (initialized || Platform.OS === 'web') return;

  const Clarity = getClarityModule();
  if (!Clarity) return;

  try {
    Clarity.initialize(CLARITY_PROJECT_ID, {
      logLevel: __DEV__ ? Clarity.LogLevel.Verbose : Clarity.LogLevel.None,
    });
    initialized = true;
  } catch (error) {
    if (__DEV__) {
      console.warn('[Clarity] initialize failed:', error);
    }
  }
}
