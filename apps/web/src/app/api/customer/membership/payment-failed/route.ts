import { NextRequest, NextResponse } from 'next/server';
import { logCustomerEvent, requireCustomer } from '@/lib/customer-api';
import { notifyMembershipPaymentFailedWhatsApp } from '@/lib/services/membershipPaymentWhatsApp';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const ctx = await requireCustomer();
  if ('response' in ctx) return ctx.response;
  const { customer, supabaseAdmin } = ctx;

  const body = await request.json().catch(() => ({}));
  const planId = String(body?.plan_id || '').trim();
  const reason = String(body?.reason || 'failed').trim();

  let planName = String(body?.plan_name || 'MyFNG Prime').trim() || 'MyFNG Prime';
  let amount = Number(body?.amount_paid || body?.amount || 0);

  if (planId) {
    const { data: plan } = await supabaseAdmin
      .from('membership_plans')
      .select('name, price')
      .eq('id', planId)
      .maybeSingle();
    if (plan) {
      planName = String(plan.name || planName);
      if (!Number.isFinite(amount) || amount <= 0) {
        amount = Number(plan.price || 0);
      }
    }
  }

  if (!Number.isFinite(amount) || amount <= 0) amount = 699;

  await logCustomerEvent(supabaseAdmin, customer.id, 'membership_payment_failed', 'membership', {
    plan_id: planId || null,
    plan_name: planName,
    amount,
    reason,
  });

  const result = await notifyMembershipPaymentFailedWhatsApp({
    customerId: customer.id,
    phone: String(customer.phone || '').trim(),
    customerName: customer.full_name,
    amount,
    planName,
    reason,
  });

  return NextResponse.json({ success: true, result });
}
