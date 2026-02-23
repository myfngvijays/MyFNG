import { NextRequest, NextResponse } from 'next/server';
import { requireCustomer } from '@/lib/customer-api';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const ctx = await requireCustomer();
  if ('response' in ctx) return ctx.response;
  const { customer, supabaseAdmin } = ctx;
  const body = await request.json().catch(() => ({}));

  const eventName = String(body.event_name || '').trim();
  if (!eventName) return NextResponse.json({ error: 'event_name required' }, { status: 400 });
  const eventGroup = String(body.event_group || 'general');
  const properties = body.properties && typeof body.properties === 'object' ? body.properties : {};

  await supabaseAdmin.from('customer_analytics_events').insert({
    customer_id: customer.id,
    event_name: eventName,
    event_group: eventGroup,
    properties,
  });

  return NextResponse.json({ success: true });
}

