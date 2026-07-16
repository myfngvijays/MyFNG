import { apiFetch } from '../api';
import { buildMobileAuthHeaders } from '../serviceBooking';
import { ENV } from '../../config/environment';
import { fetchPrimeMembershipConfig } from '../membershipPlan';
import { isMembershipActive } from '../membershipTheme';

export type MisaVehicle = {
  id?: string;
  make: string;
  model: string;
  vehicle_number?: string;
  variant?: string;
  is_default?: boolean;
};

export type MisaAddress = {
  id: string;
  label?: string;
  line1: string;
  line2?: string;
  city?: string;
  pincode?: string;
};

export type MisaCustomerContext = {
  isLoggedIn: boolean;
  customerId?: string;
  name?: string;
  phone?: string;
  vehicles: MisaVehicle[];
  addresses: MisaAddress[];
  walletBalance: number;
  hasActiveMembership: boolean;
  membershipPlanName?: string;
};

function normalizeAddress(raw: any): MisaAddress | null {
  const id = String(raw?.id || '').trim();
  const line1 = String(raw?.line1 || raw?.address_line1 || '').trim();
  if (!id || !line1) return null;
  return {
    id,
    label: String(raw?.label || raw?.address_type || 'Home').trim(),
    line1,
    line2: String(raw?.line2 || raw?.address_line2 || '').trim() || undefined,
    city: String(raw?.city || '').trim() || undefined,
    pincode: String(raw?.pincode || '').trim() || undefined,
  };
}

export async function loadMisaCustomerContext(): Promise<MisaCustomerContext> {
  const empty: MisaCustomerContext = {
    isLoggedIn: false,
    vehicles: [],
    addresses: [],
    walletBalance: 0,
    hasActiveMembership: false,
  };

  try {
    const [profileRes, vehiclesRes, walletRes, membershipRes, primePlan] = await Promise.all([
      apiFetch<any>('/api/customer/profile').catch(() => null),
      apiFetch<any>('/api/customer/vehicles').catch(() => null),
      apiFetch<any>('/api/customer/wallet').catch(() => null),
      apiFetch<any>('/api/customer/membership').catch(() => null),
      fetchPrimeMembershipConfig(ENV.API_URL).catch(() => null),
    ]);

    if (!profileRes?.customer && !profileRes?.profile) return empty;

    const customer = profileRes?.customer || profileRes?.profile || {};
    const vehicles = (vehiclesRes?.vehicles || []).map((v: any) => ({
      id: String(v?.id || ''),
      make: String(v?.make || '').trim(),
      model: String(v?.model_name || v?.model || '').trim(),
      vehicle_number: String(v?.vehicle_number || v?.registration_number || '').trim() || undefined,
      variant: v?.variant ? String(v.variant) : undefined,
      is_default: Boolean(v?.is_default),
    })) as MisaVehicle[];

    const addresses = (profileRes?.addresses || [])
      .map(normalizeAddress)
      .filter(Boolean) as MisaAddress[];

    const walletBalance = Number(
      walletRes?.wallet?.spendable_balance ?? walletRes?.wallet?.current_balance ?? 0,
    );

    const membership = membershipRes?.membership || null;
    const hasActiveMembership = isMembershipActive(membership);

    return {
      isLoggedIn: true,
      customerId: String(customer?.id || '').trim() || undefined,
      name: String(customer?.full_name || customer?.name || '').trim() || undefined,
      phone: String(customer?.phone || '').replace(/\D/g, '').slice(-10) || undefined,
      vehicles,
      addresses,
      walletBalance: Number.isFinite(walletBalance) ? walletBalance : 0,
      hasActiveMembership,
      membershipPlanName: primePlan?.name || 'MyFNG Prime',
    };
  } catch {
    return empty;
  }
}

export async function syncTrustedCustomerSession(sessionId: string): Promise<Record<string, unknown> | null> {
  if (!sessionId) return null;
  try {
    const headers = await buildMobileAuthHeaders();
    const res = await fetch(`${ENV.API_URL}/api/chatbot/v2/verification`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ action: 'sync_trusted_customer', session_id: sessionId }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.success) return null;
    return (json?.contextPatch as Record<string, unknown>) || null;
  } catch {
    return null;
  }
}
