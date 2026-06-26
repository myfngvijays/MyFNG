import auth from '@react-native-firebase/auth';
import { supabase } from './supabase';
import { clearCustomerSessionToken, getCustomerSessionToken } from './customerSession';
import { deactivateCustomerFcmPushTokens } from '../services/pushNotifications';

export async function performCustomerLogout(apiUrl: string): Promise<void> {
  const token = await getCustomerSessionToken();
  if (token) {
    await deactivateCustomerFcmPushTokens(apiUrl, token).catch(() => null);
    await fetch(`${apiUrl.replace(/\/$/, '')}/api/customer/auth/logout`, {
      method: 'POST',
      headers: { 'x-customer-session': token },
    }).catch(() => null);
  }
  await clearCustomerSessionToken();
  await supabase.auth.signOut().catch(() => null);
  try {
    if (auth().currentUser) {
      await auth().signOut();
    }
  } catch {
    // ignore — best effort
  }
}
