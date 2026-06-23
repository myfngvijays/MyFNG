import { Platform } from 'react-native';
import auth from '@react-native-firebase/auth';
import { ENV } from '../config/environment';
import { supabase } from './supabase';
import { getCustomerSessionToken } from './customerSession';

export type ServiceBookingPayload = {
  lead: Record<string, unknown>;
  coupon?: Record<string, unknown>;
  subtotal?: number;
  discount_amount?: number;
  membership_bundle_discount?: number;
  include_booking_membership?: boolean;
  use_wallet?: boolean;
  service_lines?: unknown;
  service_items?: unknown;
  membership_claim?: Record<string, unknown>;
};

export type ServiceBookingResult = {
  id: string;
  lead_number: string;
  amount_payable?: number;
  wallet_deduction?: number;
  raw: Record<string, unknown>;
};

export async function buildMobileAuthHeaders(
  extra: Record<string, string> = {},
): Promise<Record<string, string>> {
  let bearerToken: string | undefined;
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    bearerToken = session?.access_token;
  } catch {
    bearerToken = undefined;
  }

  let customerSessionToken: string | null = null;
  try {
    customerSessionToken = await getCustomerSessionToken();
  } catch {
    customerSessionToken = null;
  }

  let firebaseIdToken: string | null = null;
  try {
    const firebaseUser = auth().currentUser;
    firebaseIdToken = firebaseUser ? await firebaseUser.getIdToken() : null;
  } catch {
    firebaseIdToken = null;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-App-Platform': Platform.OS,
    'x-mobile-client': 'true',
    ...extra,
  };
  if (bearerToken) headers.Authorization = `Bearer ${bearerToken}`;
  if (customerSessionToken) headers['x-customer-session'] = customerSessionToken;
  if (firebaseIdToken) headers['x-firebase-id-token'] = firebaseIdToken;
  return headers;
}

function parseBookingCreateResponse(json: any): ServiceBookingResult {
  if (!json || typeof json !== 'object') {
    throw new Error('Invalid server response. Please try again.');
  }
  const contentType = String(json?.error || '');
  if (contentType.includes('<!DOCTYPE') || contentType.includes('<html')) {
    throw new Error('Booking service unavailable. Please try again in a moment.');
  }

  const lead = json?.lead;
  const id = String(lead?.id || json?.lead_id || '').trim();
  const leadNumber = String(lead?.lead_number || json?.lead_number || '').trim();

  if (!id) {
    throw new Error(String(json?.error || 'Booking could not be saved. Please try again.'));
  }

  return {
    id,
    lead_number: leadNumber,
    amount_payable: json?.amount_payable != null ? Number(json.amount_payable) : undefined,
    wallet_deduction: json?.wallet_deduction != null ? Number(json.wallet_deduction) : undefined,
    raw: json,
  };
}

/**
 * Creates a service booking via the public endpoint (live on production).
 * When auth headers are present, the server runs the full logged-in flow
 * (wallet, membership bundle, TeleCRM, order history).
 */
export async function submitServiceBooking(payload: ServiceBookingPayload): Promise<ServiceBookingResult> {
  const headers = await buildMobileAuthHeaders();
  const res = await fetch(`${ENV.API_URL}/api/public/bookings/create`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  const text = await res.text().catch(() => '');
  let json: any = {};
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      if (text.includes('<!DOCTYPE') || text.includes('<html')) {
        throw new Error('Booking service unavailable. Please try again in a moment.');
      }
      throw new Error('Unexpected server response. Please try again.');
    }
  }

  if (!res.ok) {
    throw new Error(String(json?.error || 'Booking failed. Please try again.'));
  }

  return parseBookingCreateResponse(json);
}
