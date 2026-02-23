import AsyncStorage from '@react-native-async-storage/async-storage';

const CUSTOMER_SESSION_KEY = 'customer_session_token';

export async function getCustomerSessionToken(): Promise<string | null> {
  return AsyncStorage.getItem(CUSTOMER_SESSION_KEY);
}

export async function setCustomerSessionToken(token: string): Promise<void> {
  await AsyncStorage.setItem(CUSTOMER_SESSION_KEY, token);
}

export async function clearCustomerSessionToken(): Promise<void> {
  await AsyncStorage.removeItem(CUSTOMER_SESSION_KEY);
}

