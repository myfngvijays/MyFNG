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

  return {
    ...base,
    android: {
      ...(base.android || {}),
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
      config: {
        ...((base.ios && base.ios.config) || {}),
        googleMapsApiKey: googleMapsApiKey,
      },
    },
  };
};
