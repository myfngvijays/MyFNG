import { NextRequest, NextResponse } from 'next/server';
import { requireCustomer } from '@/lib/customer-api';
import { createAuthenticatedServiceBooking } from '@/lib/service-booking-create';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireCustomer();
    if ('response' in ctx) return ctx.response;
    const body = await request.json().catch(() => ({}));
    return createAuthenticatedServiceBooking(request, ctx, body);
  } catch (error: any) {
    console.error('[customer/bookings/create] unhandled error:', error?.message || error);
    return NextResponse.json({ error: error?.message || 'Booking failed' }, { status: 500 });
  }
}
