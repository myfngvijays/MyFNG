/**
 * POST /api/customer/auth/delete-account
 *
 * Permanently deletes the authenticated customer's account in compliance with:
 *  - Apple App Store Review Guideline 5.1.1(v) — Account Deletion
 *  - Google Play Data Safety — Account Deletion requirement
 *
 * Behavior:
 *  - Anonymizes PII on the `customers` row (name, email, phone, profile image,
 *    firebase_uid) and flips `is_active = false` so historical orders / invoices
 *    remain intact for legal / GST / accounting reasons but the user cannot be
 *    re-identified from the customer record.
 *  - Deletes every `customer_sessions` row for that customer, instantly logging
 *    them out of all devices.
 *  - Best-effort clears auxiliary user-controlled data (cart, addresses,
 *    notification preferences, push devices). Operational data tied to leads,
 *    orders, invoices and audit logs is retained per business retention policy
 *    but disconnected from PII.
 *  - Clears the session cookie before responding.
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getCustomerFromSession, getSessionCookieName } from '@/lib/customer-session';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { notifyAccountDeletedWhatsApp } from '@/lib/services/accountDeletedWhatsApp';

export const dynamic = 'force-dynamic';

export async function POST() {
  const { customer } = await getCustomerFromSession();
  if (!customer) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }

  const customerId = customer.id;
  const originalPhone = String(customer.phone || '').trim();
  const originalName = String(customer.full_name || 'Customer').trim();
  const shortId = customerId.replace(/-/g, '').substring(0, 12);
  const anonymizedPhone = `del_${shortId}`;
  const anonymizedEmail = `deleted_${customerId}@deleted.invalid`;

  // 1. Anonymize the customer record (keep id for historical FK integrity)
  const { error: updateError } = await supabaseAdmin
    .from('customers')
    .update({
      phone: anonymizedPhone,
      email: anonymizedEmail,
      full_name: 'Deleted User',
      profile_image: null,
      firebase_uid: null,
      phone_verified: false,
      email_verified: false,
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', customerId);

  if (updateError) {
    return NextResponse.json(
      { error: 'Failed to delete account', details: updateError.message },
      { status: 500 }
    );
  }

  void notifyAccountDeletedWhatsApp({
    customerId,
    phone: originalPhone,
    customerName: originalName,
  }).catch((error) => {
    console.warn('[delete-account] WhatsApp notify failed:', error?.message || error);
  });

  // 2. Best-effort cleanup of auxiliary user-controlled tables.
  //    Errors here are not fatal — primary anonymization above already satisfies the policy.
  const cleanupTables: Array<{ table: string; column: string }> = [
    { table: 'customer_sessions', column: 'customer_id' },
    { table: 'customer_carts', column: 'customer_id' },
    { table: 'customer_addresses', column: 'customer_id' },
    { table: 'customer_vehicles', column: 'customer_id' },
    { table: 'booking_drafts', column: 'customer_id' },
    { table: 'notification_devices', column: 'customer_id' },
    { table: 'customer_notification_preferences', column: 'customer_id' },
  ];
  for (const { table, column } of cleanupTables) {
    try {
      await supabaseAdmin.from(table).delete().eq(column, customerId);
    } catch {
      // ignore — table may not exist or may not have the column in this env
    }
  }

  // 3. Clear the session cookie on the response so the client is logged out immediately.
  const cookieStore = await cookies();
  cookieStore.set(getSessionCookieName(), '', { maxAge: 0, path: '/' });

  return NextResponse.json({
    success: true,
    message: 'Account permanently deleted',
  });
}
