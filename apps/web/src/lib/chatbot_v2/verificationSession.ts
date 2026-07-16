import { isPhoneVerifiedInSession, markPhoneVerifiedInSession, normalizeBookingPhone } from './bookingOtp';
import type { SessionData } from './session';
import { isValidVehicleNumber, normalizeVehicleNumber } from './vehicleNumber';

export type TrustedCustomerProfile = {
  phone: string;
  full_name?: string | null;
  id?: string;
};

export function applyTrustedCustomerToSession(
  session: SessionData,
  customer: TrustedCustomerProfile,
): boolean {
  const phone = normalizeBookingPhone(customer.phone);
  if (phone.length !== 10) return false;

  markPhoneVerifiedInSession(session, phone);
  session.bookingState = {
    ...(session.bookingState || {}),
    phoneNumber: phone,
    customerName: String(customer.full_name || session.bookingState?.customerName || '').trim() || undefined,
  };
  return true;
}

export function getVehicleNumberFromSession(session?: SessionData): string | null {
  const raw = session?.vehicleNumber || session?.bookingState?.vehicleNumber;
  const normalized = normalizeVehicleNumber(raw);
  return isValidVehicleNumber(normalized) ? normalized : null;
}

export function setVehicleNumberInSession(
  session: SessionData,
  raw: unknown,
): { ok: true; vehicleNumber: string } | { ok: false; message: string } {
  const vehicleNumber = normalizeVehicleNumber(raw);
  if (!isValidVehicleNumber(vehicleNumber)) {
    return {
      ok: false,
      message: 'Invalid vehicle number. Use format like DL01AB1234 or MH12AB1234.',
    };
  }

  session.vehicleNumber = vehicleNumber;
  session.bookingState = {
    ...(session.bookingState || {}),
    vehicleNumber,
  };

  return { ok: true, vehicleNumber };
}

export function getVerifiedPhoneFromSession(session?: SessionData): string | null {
  const phone = normalizeBookingPhone(session?.phoneVerification?.phone);
  if (!phone || !isPhoneVerifiedInSession(session, phone)) return null;
  return phone;
}

export function isPricingAllowedInSession(session?: SessionData): boolean {
  return Boolean(getVerifiedPhoneFromSession(session));
}

export function buildSessionContextPatch(
  session: SessionData,
  conversationId: string,
  extras?: {
    customerName?: string;
    isLoggedInCustomer?: boolean;
    skipNamePrompt?: boolean;
    skipMobilePrompt?: boolean;
  },
) {
  const vehicleNumber = getVehicleNumberFromSession(session);
  const customerPhone = getVerifiedPhoneFromSession(session) || normalizeBookingPhone(session?.bookingState?.phoneNumber);
  const phoneVerified = Boolean(getVerifiedPhoneFromSession(session));
  const customerName =
    String(extras?.customerName || session?.bookingState?.customerName || '').trim() || undefined;

  return {
    conversationId,
    vehicleNumber: vehicleNumber || undefined,
    customerPhone: customerPhone || undefined,
    customerName,
    phoneVerified,
    pricingEligible: isPricingAllowedInSession(session),
    isLoggedInCustomer: Boolean(extras?.isLoggedInCustomer),
    skipNamePrompt: Boolean(extras?.skipNamePrompt),
    skipMobilePrompt: Boolean(extras?.skipMobilePrompt),
  };
}
