/**
 * GET /api/customer/auth/me
 * Returns current customer from session cookie (for dashboard / client).
 */

import { NextResponse } from 'next/server';
import { getCustomerFromSession } from '@/lib/customer-session';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { customer } = await getCustomerFromSession();
  if (!customer) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json({
    customer: {
      id: customer.id,
      phone: customer.phone,
      email: customer.email,
      full_name: customer.full_name,
      profile_image: customer.profile_image,
      phone_verified: customer.phone_verified,
      email_verified: customer.email_verified,
    },
  });
}
