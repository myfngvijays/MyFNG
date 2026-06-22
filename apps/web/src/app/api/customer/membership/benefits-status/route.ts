import { NextResponse } from 'next/server';
import { requireCustomer } from '@/lib/customer-api';
import { getMembershipBenefitsStatus } from '@/lib/membership-benefits-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await requireCustomer();
  if ('response' in ctx) return ctx.response;
  const { customer, supabaseAdmin } = ctx;

  const status = await getMembershipBenefitsStatus(supabaseAdmin, customer.id);
  return NextResponse.json(status);
}
