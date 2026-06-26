import type { PublicMembershipPlan } from '@/lib/public-membership-plan';
import { fetchPublicMembershipPlans } from '@/lib/public-membership-plan';

export const MEMBERSHIP_CART_ITEM_TYPE = 'membership';
const PENDING_KEY = 'pending_membership_cart';

type PendingMembershipCart = {
  planId: string;
  planCode: string;
  planName: string;
  membershipType: 'SERVICE' | 'RSA';
  priceNum: number;
  addSecondCar?: boolean;
  addonPrice?: number;
};

type CartOptions = {
  addSecondCar?: boolean;
  redirectToCart?: boolean;
};

function unitPrice(plan: PublicMembershipPlan, options?: CartOptions) {
  return plan.price + (options?.addSecondCar ? plan.secondCarAddonPrice : 0);
}

function serviceLabel(plan: PublicMembershipPlan, addSecondCar?: boolean) {
  const base = `${plan.membershipType === 'RSA' ? 'RSA' : 'Prime'} ${plan.name} Membership`;
  return addSecondCar ? `${base} + 2nd Car` : base;
}

function cartMetadata(plan: PublicMembershipPlan, options?: CartOptions) {
  const addSecondCar = Boolean(options?.addSecondCar);
  return {
    item_type: MEMBERSHIP_CART_ITEM_TYPE,
    plan_id: plan.planId,
    plan_code: plan.planCode,
    membership_type: plan.membershipType,
    accent_color: plan.accentColor || null,
    period: plan.periodLabel,
    benefits: plan.benefits.slice(0, 6).map((b) => b.title),
    add_second_car: addSecondCar,
    addon_price: addSecondCar ? plan.secondCarAddonPrice : 0,
    second_vehicle: null,
  };
}

function savePending(plan: PublicMembershipPlan, options?: CartOptions) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(
    PENDING_KEY,
    JSON.stringify({
      planId: plan.planId,
      planCode: plan.planCode,
      planName: plan.name,
      membershipType: plan.membershipType,
      priceNum: unitPrice(plan, options),
      addSecondCar: Boolean(options?.addSecondCar),
      addonPrice: plan.secondCarAddonPrice,
    }),
  );
}

function isMembershipItem(item: any) {
  return String(item?.metadata?.item_type || '') === MEMBERSHIP_CART_ITEM_TYPE;
}

export function consumePendingMembershipCart(): PendingMembershipCart | null {
  if (typeof window === 'undefined') return null;
  const raw = window.sessionStorage.getItem(PENDING_KEY);
  if (!raw) return null;
  window.sessionStorage.removeItem(PENDING_KEY);
  try {
    return JSON.parse(raw) as PendingMembershipCart;
  } catch {
    return null;
  }
}

export async function restorePendingMembershipCart(): Promise<{ ok: boolean; error?: string }> {
  const pending = consumePendingMembershipCart();
  if (!pending?.planId) return { ok: true };

  const plans = await fetchPublicMembershipPlans();
  const plan = plans.find((p) => p.planId === pending.planId || p.planCode === pending.planCode);
  if (!plan) {
    return { ok: false, error: 'Selected membership plan is no longer available.' };
  }

  return addPublicMembershipPlanToCart(plan, { addSecondCar: pending.addSecondCar, redirectToCart: false });
}

export async function addPublicMembershipPlanToCart(
  plan: PublicMembershipPlan,
  options?: CartOptions,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const cartRes = await fetch('/api/customer/cart', { credentials: 'include' });
    if (cartRes.status === 401) {
      savePending(plan, options);
      window.location.href = `/customer/login?redirect=${encodeURIComponent('/customer/cart')}`;
      return { ok: true };
    }
    if (!cartRes.ok) {
      return { ok: false, error: 'Could not open cart. Please log in and try again.' };
    }

    const cartJson = await cartRes.json().catch(() => ({}));
    const existingItems = Array.isArray(cartJson?.items) ? cartJson.items : [];
    for (const item of existingItems.filter(isMembershipItem)) {
      if (item?.id) {
        await fetch(`/api/customer/cart?item_id=${encodeURIComponent(String(item.id))}`, {
          method: 'DELETE',
          credentials: 'include',
        });
      }
    }

    const addSecondCar = Boolean(options?.addSecondCar);
    const postRes = await fetch('/api/customer/cart', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_type: serviceLabel(plan, addSecondCar),
        quantity: 1,
        unit_price: unitPrice(plan, options),
        metadata: cartMetadata(plan, options),
      }),
    });

    if (!postRes.ok) {
      const json = await postRes.json().catch(() => ({}));
      return { ok: false, error: json?.error || 'Could not add membership to cart.' };
    }

    if (options?.redirectToCart !== false) {
      window.location.href = '/customer/cart';
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Could not add membership to cart.' };
  }
}
