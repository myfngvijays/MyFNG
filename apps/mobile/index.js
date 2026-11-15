import { AppRegistry } from 'react-native';
import { registerWorkshopGeofencingTask } from './src/lib/workshopGeofencingTask';
import App from './App';

try {
  const messaging = require('@react-native-firebase/messaging').default;
  messaging().setBackgroundMessageHandler(async (remoteMessage) => {
    const data = remoteMessage?.data || {};
    if (String(data.kind || '') !== 'SIM_DIAL') return;
    const { handleSimDialPush } = require('./src/lib/simDial');
    await handleSimDialPush(data);
  });
} catch (err) {
  console.warn('[MyFNG] Phone-dial push handler unavailable:', err);
}

try {
  registerWorkshopGeofencingTask();
} catch (err) {
  console.warn('[MyFNG] Background geofencing unavailable in this build:', err);
}

// Keep namespaced API usable in current codebase until full modular migration.
globalThis.RNFB_MODULAR_DEPRECATION_STRICT_MODE = false;
globalThis.RNFB_SILENCE_MODULAR_DEPRECATION_WARNINGS = true;

AppRegistry.registerComponent('main', () => App);
