import { AppRegistry } from 'react-native';
import { registerWorkshopGeofencingTask } from './src/lib/workshopGeofencingTask';
import App from './App';

try {
  registerWorkshopGeofencingTask();
} catch (err) {
  console.warn('[MyFNG] Background geofencing unavailable in this build:', err);
}

// Keep namespaced API usable in current codebase until full modular migration.
globalThis.RNFB_MODULAR_DEPRECATION_STRICT_MODE = false;
globalThis.RNFB_SILENCE_MODULAR_DEPRECATION_WARNINGS = true;

AppRegistry.registerComponent('main', () => App);
