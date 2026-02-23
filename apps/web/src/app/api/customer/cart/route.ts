import { NextRequest, NextResponse } from 'next/server';
import { logCustomerEvent, requireCustomer } from '@/lib/customer-api';

export const dynamic = 'force-dynamic';

async function getOrCreateCart(supabaseAdmin: any, customerId: string) {
  const { data: existing } = await supabaseAdmin
    .from('carts')
    .select('*')
    .eq('customer_id', customerId)
    .eq('status', 'ACTIVE')
    .maybeSingle();
  if (existing) return existing;

  const { data: cart, error } = await supabaseAdmin
    .from('carts')
    .insert({ customer_id: customerId, status: 'ACTIVE' })
    .select('*')
    .single();
  if (error || !cart) throw new Error('Failed to create cart');
  return cart;
}

async function recalcCart(supabaseAdmin: any, cartId: string) {
  const { data: items } = await supabaseAdmin.from('cart_items').select('quantity, total_price').eq('cart_id', cartId);
  const subtotal = (items || []).reduce((sum: number, x: any) => sum + Number(x.total_price || 0), 0);
  await supabaseAdmin.from('carts').update({ subtotal, grand_total: subtotal, updated_at: new Date().toISOString() }).eq('id', cartId);
}

export async function GET() {
  const ctx = await requireCustomer();
  if ('response' in ctx) return ctx.response;
  const { customer, supabaseAdmin } = ctx;
  const cart = await getOrCreateCart(supabaseAdmin, customer.id);
  const { data: items } = await supabaseAdmin.from('cart_items').select('*').eq('cart_id', cart.id).order('created_at', { ascending: false });
  return NextResponse.json({ cart, items: items || [] });
}

export async function POST(request: NextRequest) {
  const ctx = await requireCustomer();
  if ('response' in ctx) return ctx.response;
  const { customer, supabaseAdmin } = ctx;
  const body = await request.json().catch(() => ({}));
  const serviceType = String(body.service_type || '').trim();
  const quantity = Math.max(1, Number(body.quantity || 1));
  const unitPrice = Number(body.unit_price || 0);

  if (!serviceType) return NextResponse.json({ error: 'service_type is required' }, { status: 400 });
  if (!Number.isFinite(unitPrice) || unitPrice < 0) return NextResponse.json({ error: 'Invalid unit_price' }, { status: 400 });

  const cart = await getOrCreateCart(supabaseAdmin, customer.id);
  const totalPrice = quantity * unitPrice;
  await supabaseAdmin.from('cart_items').insert({
    cart_id: cart.id,
    service_type: serviceType,
    quantity,
    unit_price: unitPrice,
    total_price: totalPrice,
    metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : {},
  });
  await recalcCart(supabaseAdmin, cart.id);
  await logCustomerEvent(supabaseAdmin, customer.id, 'cart_item_added', 'cart', { serviceType, quantity, unitPrice });
  return NextResponse.json({ success: true });
}

export async function PUT(request: NextRequest) {
  const ctx = await requireCustomer();
  if ('response' in ctx) return ctx.response;
  const { customer, supabaseAdmin } = ctx;
  const body = await request.json().catch(() => ({}));
  const itemId = String(body.item_id || '');
  const quantity = Math.max(1, Number(body.quantity || 1));
  if (!itemId) return NextResponse.json({ error: 'item_id is required' }, { status: 400 });

  const cart = await getOrCreateCart(supabaseAdmin, customer.id);
  const { data: item } = await supabaseAdmin.from('cart_items').select('*').eq('id', itemId).eq('cart_id', cart.id).maybeSingle();
  if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });
  const totalPrice = Number(item.unit_price || 0) * quantity;
  await supabaseAdmin.from('cart_items').update({ quantity, total_price: totalPrice, updated_at: new Date().toISOString() }).eq('id', itemId);
  await recalcCart(supabaseAdmin, cart.id);
  await logCustomerEvent(supabaseAdmin, customer.id, 'cart_item_updated', 'cart', { itemId, quantity });
  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const ctx = await requireCustomer();
  if ('response' in ctx) return ctx.response;
  const { customer, supabaseAdmin } = ctx;
  const { searchParams } = new URL(request.url);
  const itemId = searchParams.get('item_id');
  if (!itemId) return NextResponse.json({ error: 'item_id required' }, { status: 400 });

  const cart = await getOrCreateCart(supabaseAdmin, customer.id);
  await supabaseAdmin.from('cart_items').delete().eq('id', itemId).eq('cart_id', cart.id);
  await recalcCart(supabaseAdmin, cart.id);
  await logCustomerEvent(supabaseAdmin, customer.id, 'cart_item_removed', 'cart', { itemId });
  return NextResponse.json({ success: true });
}

