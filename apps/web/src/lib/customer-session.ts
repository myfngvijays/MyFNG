/**
 * Customer session (cookie-based after Firebase OTP verify).
 * Used by /api/customer/auth/* and any route that needs current customer.
 */

import { cookies, headers } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { createClient } from '@/lib/supabase/server';
import { verifyFirebaseIdToken } from '@/lib/firebase/admin';

const CUSTOMER_SESSION_COOKIE = 'customer_session';
const SESSION_DAYS = 30;

export function generateSessionToken(): string {
  const array = new Uint8Array(32);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(array);
  } else {
    for (let i = 0; i < array.length; i++) array[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
}

export interface CustomerSessionRow {
  id: string;
  customer_id: string;
  token: string;
  expires_at: string;
}

export interface CustomerRow {
  id: string;
  phone: string;
  firebase_uid: string | null;
  email: string | null;
  full_name: string | null;
  profile_image: string | null;
  phone_verified: boolean;
  email_verified: boolean;
  is_active: boolean;
}

export async function getCustomerFromSession(): Promise<{
  customer: CustomerRow | null;
  session: CustomerSessionRow | null;
}> {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return { customer: null, session: null };

  const cookieStore = await cookies();
  const headerStore = await headers();
  const headerToken = headerStore.get('x-customer-session') || headerStore.get('X-Customer-Session');
  const token = headerToken || cookieStore.get(CUSTOMER_SESSION_COOKIE)?.value;

  if (token) {
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('customer_sessions')
      .select('id, customer_id, token, expires_at')
      .eq('token', token)
      .single();

    if (!sessionError && session) {
      if (new Date(session.expires_at) < new Date()) {
        await supabaseAdmin.from('customer_sessions').delete().eq('id', session.id);
      } else {
        const { data: customer, error: customerError } = await supabaseAdmin
          .from('customers')
          .select('id, phone, firebase_uid, email, full_name, profile_image, phone_verified, email_verified, is_active')
          .eq('id', session.customer_id)
          .single();

        if (!customerError && customer && customer.is_active) {
          return { customer: customer as CustomerRow, session: session as CustomerSessionRow };
        }
      }
    }
  }

  const normalizePhone = (v: string | null | undefined): string | null => {
    const digits = String(v || '').replace(/\D/g, '');
    if (!digits) return null;
    return digits.slice(-10);
  };

  const upsertCustomerFromFirebase = async (
    firebaseUid: string,
    phoneRaw: string | undefined
  ): Promise<CustomerRow | null> => {
    const normalizedPhone = normalizePhone(phoneRaw);

    let existingCustomer: any = null;
    const { data: byUid } = await supabaseAdmin
      .from('customers')
      .select('id, phone, firebase_uid, email, full_name, profile_image, phone_verified, email_verified, is_active')
      .eq('firebase_uid', firebaseUid)
      .maybeSingle();
    existingCustomer = byUid;

    if (!existingCustomer && normalizedPhone) {
      const { data: byPhone } = await supabaseAdmin
        .from('customers')
        .select('id, phone, firebase_uid, email, full_name, profile_image, phone_verified, email_verified, is_active')
        .eq('phone', normalizedPhone)
        .maybeSingle();
      existingCustomer = byPhone;
    }

    if (existingCustomer) {
      const { data: updated } = await supabaseAdmin
        .from('customers')
        .update({
          firebase_uid: firebaseUid,
          phone: normalizedPhone || existingCustomer.phone,
          phone_verified: normalizedPhone ? true : existingCustomer.phone_verified,
          last_login_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingCustomer.id)
        .select('id, phone, firebase_uid, email, full_name, profile_image, phone_verified, email_verified, is_active')
        .single();
      return (updated as CustomerRow) || (existingCustomer as CustomerRow);
    }

    if (!normalizedPhone) return null;

    const { data: inserted } = await supabaseAdmin
      .from('customers')
      .insert({
        phone: normalizedPhone,
        firebase_uid: firebaseUid,
        phone_verified: true,
        email_verified: false,
        is_active: true,
        full_name: `Customer ${normalizedPhone.slice(-4)}`,
        last_login_at: new Date().toISOString(),
      })
      .select('id, phone, firebase_uid, email, full_name, profile_image, phone_verified, email_verified, is_active')
      .single();
    return (inserted as CustomerRow) || null;
  };

  // Firebase-first fallback for mobile/web clients that send ID token directly.
  const firebaseHeaderToken =
    headerStore.get('x-firebase-id-token') || headerStore.get('X-Firebase-Id-Token');
  if (firebaseHeaderToken) {
    try {
      const decoded = await verifyFirebaseIdToken(firebaseHeaderToken);
      const customer = await upsertCustomerFromFirebase(decoded.uid, decoded.phone_number);
      if (customer && customer.is_active) {
        return { customer, session: null };
      }
    } catch {
      // ignore and continue to legacy fallbacks
    }
  }

  // Mobile fallback: Authorization bearer (Supabase access token)
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData?.user;
  if (!user) return { customer: null, session: null };

  const { data: profileById } = await supabaseAdmin
    .from('users_login')
    .select('id, email, phone, full_name')
    .eq('id', user.id)
    .maybeSingle();

  const normalizedPhone = (profileById?.phone || '').replace(/\D/g, '').slice(-10) || null;
  const email = profileById?.email || user.email || null;
  const fullName = profileById?.full_name || user.user_metadata?.full_name || null;

  let existingCustomer: any = null;
  if (normalizedPhone) {
    const { data } = await supabaseAdmin
      .from('customers')
      .select('id, phone, firebase_uid, email, full_name, profile_image, phone_verified, email_verified, is_active')
      .eq('phone', normalizedPhone)
      .maybeSingle();
    existingCustomer = data;
  }
  if (!existingCustomer && email) {
    const { data } = await supabaseAdmin
      .from('customers')
      .select('id, phone, firebase_uid, email, full_name, profile_image, phone_verified, email_verified, is_active')
      .eq('email', email)
      .maybeSingle();
    existingCustomer = data;
  }

  if (existingCustomer) {
    await supabaseAdmin
      .from('customers')
      .update({
        phone: normalizedPhone || existingCustomer.phone,
        email: email || existingCustomer.email,
        full_name: fullName || existingCustomer.full_name,
        phone_verified: normalizedPhone ? true : existingCustomer.phone_verified,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingCustomer.id);
    return { customer: existingCustomer as CustomerRow, session: null };
  }

  if (!normalizedPhone) return { customer: null, session: null };

  const { data: inserted } = await supabaseAdmin
    .from('customers')
    .insert({
      phone: normalizedPhone,
      email,
      full_name: fullName || `Customer ${normalizedPhone.slice(-4)}`,
      phone_verified: true,
      email_verified: Boolean(email),
      is_active: true,
      last_login_at: new Date().toISOString(),
    })
    .select('id, phone, firebase_uid, email, full_name, profile_image, phone_verified, email_verified, is_active')
    .single();

  return { customer: (inserted as CustomerRow) || null, session: null };
}

export function getSessionCookieName(): string {
  return CUSTOMER_SESSION_COOKIE;
}

export function getSessionMaxAgeSeconds(): number {
  return SESSION_DAYS * 24 * 60 * 60;
}
