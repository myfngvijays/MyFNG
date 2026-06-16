import AsyncStorage from '@react-native-async-storage/async-storage';

const storageKey = (customerKey: string) => `myfng_dismissed_vehicles:${customerKey}`;

export async function getDismissedVehicleKeys(customerKey: string): Promise<string[]> {
  if (!customerKey) return [];
  try {
    const raw = await AsyncStorage.getItem(storageKey(customerKey));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export async function dismissVehicleKey(customerKey: string, vehicleKey: string): Promise<void> {
  if (!customerKey || !vehicleKey) return;
  const existing = await getDismissedVehicleKeys(customerKey);
  if (existing.includes(vehicleKey)) return;
  await AsyncStorage.setItem(storageKey(customerKey), JSON.stringify([...existing, vehicleKey]));
}

export async function dismissVehicleKeys(customerKey: string, vehicleKeys: string[]): Promise<void> {
  if (!customerKey || !vehicleKeys.length) return;
  const existing = new Set(await getDismissedVehicleKeys(customerKey));
  vehicleKeys.forEach((key) => existing.add(key));
  await AsyncStorage.setItem(storageKey(customerKey), JSON.stringify([...existing]));
}

export async function saveDismissedVehicleKeys(customerKey: string, vehicleKeys: string[]): Promise<void> {
  if (!customerKey) return;
  await AsyncStorage.setItem(storageKey(customerKey), JSON.stringify(vehicleKeys));
}
