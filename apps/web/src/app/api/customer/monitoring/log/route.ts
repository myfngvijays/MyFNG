import { NextRequest, NextResponse } from 'next/server';
import { requireCustomer } from '@/lib/customer-api';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const ctx = await requireCustomer();
  if ('response' in ctx) return ctx.response;
  const { customer, supabaseAdmin } = ctx;
  const body = await request.json().catch(() => ({}));

  const level = String(body.level || 'INFO').toUpperCase();
  const module = String(body.module || 'customer');
  const message = String(body.message || '').trim();
  if (!message) return NextResponse.json({ error: 'message required' }, { status: 400 });

  await supabaseAdmin.from('customer_monitoring_logs').insert({
    level,
    module,
    message,
    context: {
      customer_id: customer.id,
      ...((body.context && typeof body.context === 'object') ? body.context : {}),
    },
  });

  return NextResponse.json({ success: true });
}

