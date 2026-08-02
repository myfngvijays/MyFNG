import { requireOptionalNativeModule } from 'expo-modules-core';
import { Alert, Linking, Platform } from 'react-native';

export type ParsedContact = {
  id: string;
  name: string;
  phone: string;
  initials: string;
};

export type ContactsAccessState = {
  granted: boolean;
  limited: boolean;
  canAskAgain: boolean;
  moduleAvailable: boolean;
};

type ExpoContactsModule = typeof import('expo-contacts');

function getContactsModule(): ExpoContactsModule | null {
  const native = requireOptionalNativeModule('ExpoContacts');
  if (!native) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('expo-contacts') as ExpoContactsModule;
  } catch {
    return null;
  }
}

function parseContactRows(data: import('expo-contacts').Contact[]): ParsedContact[] {
  return (data || [])
    .filter((c) => c.phoneNumbers && c.phoneNumbers.length > 0)
    .map((c) => {
      const name = [c.firstName, c.lastName].filter(Boolean).join(' ') || c.name || 'Unknown';
      const phone = c.phoneNumbers![0]?.number || '';
      const initials = name
        .split(' ')
        .map((w) => w[0]?.toUpperCase() || '')
        .slice(0, 2)
        .join('');
      return { id: c.id || phone, name, phone, initials };
    });
}

export function isContactsNativeModuleAvailable(): boolean {
  return getContactsModule() != null;
}

export function showContactsUnavailableAlert() {
  Alert.alert(
    'Contacts not available',
    'Simulator ya device purane build par chal raha hai. Contacts ke liye terminal se npx expo run:ios chala kar fresh build install karein.',
    [{ text: 'OK', style: 'default' }],
  );
}

export async function getContactsAccessState(): Promise<ContactsAccessState> {
  const Contacts = getContactsModule();
  if (!Contacts) {
    return { granted: false, limited: false, canAskAgain: false, moduleAvailable: false };
  }
  const perm = await Contacts.getPermissionsAsync();
  return {
    granted: perm.status === 'granted',
    limited: perm.accessPrivileges === 'limited',
    canAskAgain: perm.canAskAgain ?? true,
    moduleAvailable: true,
  };
}

export async function getContactsPermissionGranted(): Promise<boolean> {
  const state = await getContactsAccessState();
  return state.granted;
}

export async function requestContactsPermission(): Promise<ContactsAccessState> {
  const Contacts = getContactsModule();
  if (!Contacts) {
    showContactsUnavailableAlert();
    return { granted: false, limited: false, canAskAgain: false, moduleAvailable: false };
  }

  const current = await Contacts.getPermissionsAsync();
  if (current.status !== 'granted') {
    await Contacts.requestPermissionsAsync();
  }

  return getContactsAccessState();
}

export function showContactsPermissionAlert(canAskAgain = true) {
  Alert.alert(
    'Contacts access required',
    canAskAgain
      ? 'Please allow contacts access to invite friends via Refer & Rise.'
      : 'Contacts access was denied. Enable it from Settings to invite friends via Refer & Rise.',
    canAskAgain
      ? [{ text: 'OK', style: 'default' }]
      : [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ],
  );
}

export async function loadDeviceContacts(): Promise<ParsedContact[]> {
  const Contacts = getContactsModule();
  if (!Contacts) {
    showContactsUnavailableAlert();
    return [];
  }

  const access = await getContactsAccessState();
  if (!access.granted) return [];

  const { data } = await Contacts.getContactsAsync({
    fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
    sort: Contacts.SortTypes.FirstName,
  });

  return parseContactRows(data || []);
}

/** iOS limited access: let user pick more contacts. Android: re-open permission or settings. */
export async function openAddMoreContactsPicker(): Promise<boolean> {
  const Contacts = getContactsModule();
  if (!Contacts) {
    showContactsUnavailableAlert();
    return false;
  }

  const access = await getContactsAccessState();
  if (!access.granted) {
    const next = await requestContactsPermission();
    return next.granted;
  }

  if (access.limited && typeof Contacts.presentAccessPickerAsync === 'function') {
    try {
      await Contacts.presentAccessPickerAsync();
      return true;
    } catch {
      // fall through
    }
  }

  if (typeof Contacts.presentContactPickerAsync === 'function') {
    try {
      const picked = await Contacts.presentContactPickerAsync();
      return picked != null;
    } catch {
      // fall through
    }
  }

  if (Platform.OS === 'android') {
    Linking.openSettings();
  } else {
    Alert.alert(
      'Add more contacts',
      'Phone Settings → MyFNG → Contacts se aur contacts allow karein.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ],
    );
  }
  return false;
}
