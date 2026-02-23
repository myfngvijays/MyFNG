import { NextResponse } from 'next/server';
import { requireCustomer } from '@/lib/customer-api';

export const dynamic = 'force-dynamic';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireCustomer();
  if ('response' in ctx) return ctx.response;
  const { customer, supabaseAdmin } = ctx;
  const { id } = await params;

  const { data: lead, error } = await supabaseAdmin
    .from('service_leads')
    .select('*')
    .eq('id', id)
    .eq('customer_phone', customer.phone)
    .maybeSingle();
  if (error || !lead) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

  const { data: invoice } = await supabaseAdmin
    .from('invoices')
    .select('id, invoice_number, payment_status, final_amount, created_at')
    .eq('lead_id', id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ order: lead, invoice: invoice || null });
}

