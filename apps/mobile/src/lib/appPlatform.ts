import { Platform } from 'react-native';

export type MobileContentPlatform = 'android' | 'ios';

export function getMobileContentPlatform(): MobileContentPlatform {
  return Platform.OS === 'ios' ? 'ios' : 'android';
}
