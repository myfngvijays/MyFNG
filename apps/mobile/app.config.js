/**
 * Expo dynamic config to inject build-time keys from environment variables.
 * Needed for native modules like Google Maps on Android (react-native-maps).
 *
 * Expected env vars (any one):
 * - GOOGLE_MAPS_API_KEY
 * - EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
 *
 * After setting the key, rebuild the dev client:
 *   cd apps/mobile && npm run android
 */

require('dotenv').config();
const appJson = require('./app.json');

module.exports = ({ config }) => {
  const base = (appJson && appJson.expo) || config || {};

  const googleMapsApiKey =
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
    (base.android && base.android.config && base.android.config.googleMaps && base.android.config.googleMaps.apiKey) ||
    (base.ios && base.ios.config && base.ios.config.googleMapsApiKey) ||
    undefined;

  // customer | partner split the phone apps. Unset keeps the current single app.
  const appVariantRaw = String(process.env.APP_VARIANT || 'unified').trim().toLowerCase();
  const appVariant =
    appVariantRaw === 'customer' || appVariantRaw === 'partner' ? appVariantRaw : 'unified';
  const partner = appVariant === 'partner';

  return {
    ...base,
    version: partner ? '1.0.6' : base.version,
    splash: {
      ...(base.splash || {}),
      backgroundColor: partner ? '#021E6F' : base.splash && base.splash.backgroundColor,
    },
    extra: {
      ...(base.extra || {}),
      appVariant,
    },
    android: {
      ...(base.android || {}),
      package: partner ? 'com.myfng.partner' : base.android && base.android.package,
      versionCode: partner ? 6 : base.android && base.android.versionCode,
      config: {
        ...((base.android && base.android.config) || {}),
        googleMaps: {
          ...((base.android && base.android.config && base.android.config.googleMaps) || {}),
          apiKey: googleMapsApiKey,
        },
      },
    },
    ios: {
      ...(base.ios || {}),
      bundleIdentifier: partner ? 'com.myfng.partner' : base.ios && base.ios.bundleIdentifier,
      buildNumber: partner ? '6' : base.ios && base.ios.buildNumber,
      config: {
        ...((base.ios && base.ios.config) || {}),
        googleMapsApiKey: googleMapsApiKey,
      },
    },
  };
};
