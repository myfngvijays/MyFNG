import type { AppMembershipPlan } from './membershipPlan';
import {
  isMembershipCartItem,
  membershipCartServiceLabel,
  membershipCartUnitPrice,
  planToCartMetadata,
  savePendingMembershipCart,
  type MembershipSecondVehicle,
} from './membershipCart';
import { notifyCartBadgeCountChanged } from './cartBadgeCount';

type ApiFetch = (path: string, init?: RequestInit) => Promise<any>;
type GetToken = () => Promise<string | null>;

export async function addMembershipPlanToCart(opts: {
  navigation: any;
  plan: AppMembershipPlan;
  addSecondCar?: boolean;
  secondVehicle?: MembershipSecondVehicle | null;
  apiFetch: ApiFetch;
  getToken: GetToken;
}): Promise<{ ok: boolean; error?: string }> {
  const { navigation, plan, apiFetch, getToken } = opts;
  if (!plan.planId) {
    return { ok: false, error: 'Plan details not available. Please try again.' };
  }

  const cartOptions = {
    addSecondCar: Boolean(opts.addSecondCar),
    addonPrice: plan.addOn?.priceNum,
    secondVehicle: opts.secondVehicle || null,
  };

  const token = await getToken().catch(() => null);
  if (!token) {
    await savePendingMembershipCart(plan, cartOptions);
    navigation.navigate('Settings', { subPage: 'Cart' });
    return { ok: true };
  }

  const cartRes = await apiFetch('/api/customer/cart').catch(() => null);
  const existingItems = Array.isArray(cartRes?.items) ? cartRes.items : [];
  for (const item of existingItems.filter(isMembershipCartItem)) {
    if (item?.id) {
      await apiFetch(`/api/customer/cart?item_id=${encodeURIComponent(String(item.id))}`, {
        method: 'DELETE',
      });
    }
  }

  await apiFetch('/api/customer/cart', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service_type: membershipCartServiceLabel(plan, cartOptions.addSecondCar),
      quantity: 1,
      unit_price: membershipCartUnitPrice(plan, cartOptions),
      metadata: planToCartMetadata(plan, cartOptions),
    }),
  });

  notifyCartBadgeCountChanged();
  navigation.navigate('Settings', { subPage: 'Cart' });
  return { ok: true };
}

export function membershipActivateButtonLabel(membershipType?: string | null): string {
  return String(membershipType || '').toUpperCase() === 'RSA'
    ? 'Activate RSA Membership'
    : 'Activate Prime';
}
