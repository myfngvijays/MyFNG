/**
 * POST /api/customer/auth/logout
 * Clears customer session cookie and deletes session from DB.
 */

import { NextResponse } from 'next/server';
import { getCustomerFromSession, getSessionCookieName } from '@/lib/customer-session';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function POST() {
  const { session } = await getCustomerFromSession();
  if (session) {
    const { supabaseAdmin } = getSupabaseAdmin();
    if (supabaseAdmin) {
      await supabaseAdmin.from('customer_sessions').delete().eq('id', session.id);
    }
  }
  const cookieStore = await cookies();
  cookieStore.set(getSessionCookieName(), '', { maxAge: 0, path: '/' });
  return NextResponse.json({ success: true });
}
