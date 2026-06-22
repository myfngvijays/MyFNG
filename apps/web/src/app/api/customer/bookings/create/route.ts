import { NextRequest, NextResponse } from 'next/server';
import { logCustomerEvent, requireCustomer } from '@/lib/customer-api';
import {
  debitWallet,
  resolveWalletDeduction,
} from '@/lib/wallet-service';

export const dynamic = 'force-dynamic';

function generateLeadNumber() {
  return `L-${Date.now().toString().slice(-8)}`;
}

export async function POST(request: NextRequest) {
  const ctx = await requireCustomer();
  if ('response' in ctx) return ctx.response;
  const { customer, supabaseAdmin } = ctx;

  const body = await request.json().catch(() => ({}));
  const lead = body?.lead || {};
  const useWallet = Boolean(body.use_wallet);
  const subtotal = Number(body.subtotal || lead.estimated_amount || 0);
  const couponDiscount = Number(body.discount_amount || lead.discount_amount || 0);
  const payableBeforeWallet = Math.max(0, subtotal - couponDiscount);
  const vehicleNumber = String(lead.vehicle_number || body.vehicle_number || '').trim();

  const resolved = await resolveWalletDeduction(
    supabaseAdmin,
    customer.id,
    payableBeforeWallet,
    'SERVICE',
    useWallet,
    vehicleNumber || null,
  );

  if (resolved.blocked && useWallet) {
    return NextResponse.json({ error: resolved.reason || 'Wallet cannot be used for this vehicle' }, { status: 400 });
  }

  const walletDeduction = resolved.deduction;
  const finalAmount = Math.max(0, payableBeforeWallet - walletDeduction);
  const leadNumber = String(lead.lead_number || generateLeadNumber());

  const { data: serviceLead, error: leadError } = await supabaseAdmin
    .from('service_leads')
    .insert({
      ...lead,
      lead_number: leadNumber,
      customer_name: lead.customer_name || customer.full_name || `Customer ${customer.phone}`,
      customer_phone: customer.phone,
      customer_email: customer.email || lead.customer_email || null,
      estimated_amount: finalAmount,
      actual_amount: finalAmount,
      status: lead.status || 'NEW',
      lead_type: lead.lead_type || 'NORMAL',
      created_from: lead.created_from || 'MOBILE_APP',
    })
    .select('id, lead_number')
    .single();

  if (leadError || !serviceLead) {
    return NextResponse.json({ error: leadError?.message || 'Booking failed' }, { status: 500 });
  }

  if (walletDeduction > 0) {
    await debitWallet(supabaseAdmin, customer.id, walletDeduction, {
      source: 'ORDER_REDEEM',
      idempotencyKey: `booking:${serviceLead.id}`,
      channel: 'SERVICE',
      vehicleNumber: vehicleNumber || null,
      metadata: {
        label: 'Used for Service Booking',
        lead_id: serviceLead.id,
        lead_number: serviceLead.lead_number,
        subtotal,
        coupon_discount: couponDiscount,
        usage_percent: 10,
        vehicle_number: vehicleNumber || null,
      },
    });
  }

  await logCustomerEvent(supabaseAdmin, customer.id, 'service_booking_created', 'booking', {
    leadId: serviceLead.id,
    subtotal,
    walletDeduction,
    finalAmount,
  });

  return NextResponse.json({
    success: true,
    lead: serviceLead,
    wallet_deduction: walletDeduction,
    amount_payable: finalAmount,
  });
}
