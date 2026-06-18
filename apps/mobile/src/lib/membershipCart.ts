import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppMembershipPlan } from './membershipPlan';

export const MEMBERSHIP_CART_ITEM_TYPE = 'membership';
export const PENDING_MEMBERSHIP_CART_KEY = 'pending_membership_cart';

export type MembershipSecondVehicle = {
  vehicle_number: string;
  make: string;
  model: string;
};

export type PendingMembershipCartPlan = {
  planId: string;
  planCode: string;
  planName: string;
  membershipType: 'SERVICE' | 'RSA';
  priceNum: number;
  accentColor?: string;
  addSecondCar?: boolean;
  addonPrice?: number;
  secondVehicle?: MembershipSecondVehicle | null;
};

export type MembershipCartOptions = {
  addSecondCar?: boolean;
  addonPrice?: number;
  secondVehicle?: MembershipSecondVehicle | null;
};

export function isMembershipCartItem(item: any): boolean {
  return String(item?.metadata?.item_type || '') === MEMBERSHIP_CART_ITEM_TYPE;
}

export function membershipCartUnitPrice(plan: AppMembershipPlan, options?: MembershipCartOptions) {
  const addonPrice = Number(options?.addonPrice ?? plan.addOn?.priceNum ?? 0);
  return plan.priceNum + (options?.addSecondCar ? addonPrice : 0);
}

export function planToCartMetadata(plan: AppMembershipPlan, options?: MembershipCartOptions) {
  const benefits = (plan.valueCard?.benefits || plan.benefits || []).slice(0, 6).map((b) => b.title);
  const addSecondCar = Boolean(options?.addSecondCar);
  const addonPrice = Number(options?.addonPrice ?? plan.addOn?.priceNum ?? 0);
  return {
    item_type: MEMBERSHIP_CART_ITEM_TYPE,
    plan_id: plan.planId,
    plan_code: plan.planCode,
    membership_type: plan.membershipType,
    accent_color: plan.accentColor || null,
    period: plan.period,
    benefits,
    add_second_car: addSecondCar,
    addon_price: addSecondCar ? addonPrice : 0,
    second_vehicle: addSecondCar && options?.secondVehicle ? options.secondVehicle : null,
  };
}

export function membershipCartServiceLabel(plan: AppMembershipPlan, addSecondCar?: boolean) {
  const base = `${plan.membershipType === 'RSA' ? 'RSA' : 'Prime'} ${plan.name} Membership`;
  return addSecondCar ? `${base} + 2nd Car` : base;
}

export async function savePendingMembershipCart(plan: AppMembershipPlan, options?: MembershipCartOptions) {
  const payload: PendingMembershipCartPlan = {
    planId: String(plan.planId || ''),
    planCode: String(plan.planCode || ''),
    planName: plan.name,
    membershipType: plan.membershipType,
    priceNum: membershipCartUnitPrice(plan, options),
    accentColor: plan.accentColor,
    addSecondCar: Boolean(options?.addSecondCar),
    addonPrice: Number(options?.addonPrice ?? plan.addOn?.priceNum ?? 0),
    secondVehicle: options?.secondVehicle || null,
  };
  await AsyncStorage.setItem(PENDING_MEMBERSHIP_CART_KEY, JSON.stringify(payload));
}

export async function consumePendingMembershipCart(): Promise<PendingMembershipCartPlan | null> {
  const raw = await AsyncStorage.getItem(PENDING_MEMBERSHIP_CART_KEY);
  if (!raw) return null;
  await AsyncStorage.removeItem(PENDING_MEMBERSHIP_CART_KEY);
  try {
    return JSON.parse(raw) as PendingMembershipCartPlan;
  } catch {
    return null;
  }
}
