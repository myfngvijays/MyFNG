import { NextRequest, NextResponse } from 'next/server';
import { ensureWalletAccount, logCustomerEvent, requireCustomer } from '@/lib/customer-api';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const ctx = await requireCustomer();
  if ('response' in ctx) return ctx.response;
  const { customer, supabaseAdmin } = ctx;
  const body = await request.json().catch(() => ({}));
  const useWallet = Boolean(body.use_wallet);
  const vehicleNumber = String(body.vehicle_number || '').trim();

  const { data: cart } = await supabaseAdmin
    .from('carts')
    .select('*')
    .eq('customer_id', customer.id)
    .eq('status', 'ACTIVE')
    .maybeSingle();
  if (!cart) return NextResponse.json({ error: 'No active cart' }, { status: 400 });

  const { data: items } = await supabaseAdmin.from('cart_items').select('*').eq('cart_id', cart.id);
  if (!items || items.length === 0) return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });

  const subtotal = (items || []).reduce((sum: number, x: any) => sum + Number(x.total_price || 0), 0);
  let walletDeduction = 0;
  if (useWallet) {
    const wallet = await ensureWalletAccount(supabaseAdmin, customer.id);
    walletDeduction = Math.min(Number(wallet.current_balance || 0), subtotal);
    if (walletDeduction > 0) {
      const nextBalance = Number(wallet.current_balance || 0) - walletDeduction;
      await supabaseAdmin.from('wallet_transactions').insert({
        wallet_account_id: wallet.id,
        customer_id: customer.id,
        transaction_type: 'DEBIT',
        amount: walletDeduction,
        balance_after: nextBalance,
        source: 'ORDER_REDEEM',
        idempotency_key: `checkout:${cart.id}`,
        metadata: { cart_id: cart.id },
      });
      await supabaseAdmin.from('wallet_accounts').update({
        current_balance: nextBalance,
        lifetime_debited: Number(wallet.lifetime_debited || 0) + walletDeduction,
        updated_at: new Date().toISOString(),
      }).eq('id', wallet.id);
    }
  }

  const finalAmount = subtotal - walletDeduction;
  const serviceType = items.map((x: any) => x.service_type).join(', ');
  const { data: lead, error } = await supabaseAdmin
    .from('service_leads')
    .insert({
      customer_name: customer.full_name || `Customer ${customer.phone}`,
      customer_phone: customer.phone,
      customer_email: customer.email,
      vehicle_number: vehicleNumber || 'TBD',
      service_type: serviceType,
      subservice_ids: [],
      service_type_ids: [],
      estimated_amount: finalAmount,
      actual_amount: finalAmount,
      status: 'NEW',
      lead_type: 'NORMAL',
    })
    .select('id, lead_number')
    .single();
  if (error || !lead) return NextResponse.json({ error: 'Checkout failed' }, { status: 500 });

  await supabaseAdmin.from('carts').update({
    status: 'CHECKED_OUT',
    subtotal,
    wallet_deduction: walletDeduction,
    grand_total: finalAmount,
    updated_at: new Date().toISOString(),
  }).eq('id', cart.id);

  await logCustomerEvent(supabaseAdmin, customer.id, 'cart_checkout_success', 'cart', {
    cartId: cart.id,
    leadId: lead.id,
    subtotal,
    walletDeduction,
    finalAmount,
  });

  return NextResponse.json({ success: true, lead, amount_payable: finalAmount });
}

