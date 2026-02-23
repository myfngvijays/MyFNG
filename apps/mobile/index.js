import { AppRegistry } from 'react-native';
import App from './App';

// Keep namespaced API usable in current codebase until full modular migration.
globalThis.RNFB_MODULAR_DEPRECATION_STRICT_MODE = false;
globalThis.RNFB_SILENCE_MODULAR_DEPRECATION_WARNINGS = true;

AppRegistry.registerComponent('main', () => App);
