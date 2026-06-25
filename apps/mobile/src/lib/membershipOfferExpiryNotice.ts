import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import {
  buildMembershipOfferExpiredView,
  membershipOfferExpiredMessage,
  membershipOfferExpiredTitle,
  type MembershipOfferExpiredView,
} from './postBookingMembershipOffer';

const STORAGE_PREFIX = 'membership_offer_expired_notice_v1:';

function storageKey(orderId: string): string {
  return `${STORAGE_PREFIX}${orderId}`;
}

export async function hasShownMembershipOfferExpiryNotice(orderId: string): Promise<boolean> {
  const id = String(orderId || '').trim();
  if (!id) return true;
  const value = await AsyncStorage.getItem(storageKey(id));
  return value === '1';
}

export async function markMembershipOfferExpiryNoticeShown(orderId: string): Promise<void> {
  const id = String(orderId || '').trim();
  if (!id) return;
  await AsyncStorage.setItem(storageKey(id), '1');
}

export async function notifyMembershipOfferExpiredOnce(
  order: any,
  onAcknowledged?: (view: MembershipOfferExpiredView) => void,
): Promise<boolean> {
  const view = buildMembershipOfferExpiredView(order);
  if (!view?.orderId) return false;
  if (await hasShownMembershipOfferExpiryNotice(view.orderId)) return false;

  await markMembershipOfferExpiryNoticeShown(view.orderId);
  Alert.alert(membershipOfferExpiredTitle(), membershipOfferExpiredMessage(view), [
    {
      text: 'OK',
      onPress: () => onAcknowledged?.(view),
    },
  ]);
  return true;
}
