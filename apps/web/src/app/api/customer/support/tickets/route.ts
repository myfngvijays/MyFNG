import { NextRequest, NextResponse } from 'next/server';
import { logCustomerEvent, requireCustomer } from '@/lib/customer-api';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await requireCustomer();
  if ('response' in ctx) return ctx.response;
  const { customer, supabaseAdmin } = ctx;

  const { data, error } = await supabaseAdmin
    .from('support_tickets')
    .select('*')
    .or(`customer_phone.eq.${customer.phone},customer_email.eq.${customer.email || ''}`)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: 'Failed to load tickets' }, { status: 500 });
  return NextResponse.json({ tickets: data || [] });
}

export async function POST(request: NextRequest) {
  const ctx = await requireCustomer();
  if ('response' in ctx) return ctx.response;
  const { customer, supabaseAdmin } = ctx;
  const body = await request.json().catch(() => ({}));

  const subject = String(body.subject || '').trim();
  const description = String(body.description || '').trim();
  if (!subject || !description) {
    return NextResponse.json({ error: 'subject and description are required' }, { status: 400 });
  }

  const ticketNumber = `TKT-${Date.now().toString().slice(-8)}`;
  const { data, error } = await supabaseAdmin
    .from('support_tickets')
    .insert({
      ticket_number: ticketNumber,
      customer_name: customer.full_name || `Customer ${customer.phone}`,
      customer_email: customer.email,
      customer_phone: customer.phone,
      subject,
      description,
      category: body.category || 'GENERAL',
      severity: body.severity || 'MEDIUM',
      status: 'OPEN',
    })
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: 'Failed to create ticket' }, { status: 500 });
  await logCustomerEvent(supabaseAdmin, customer.id, 'support_ticket_created', 'support', { ticket: ticketNumber });
  return NextResponse.json({ ticket: data }, { status: 201 });
}

