import { NextRequest, NextResponse } from 'next/server';
import { logCustomerEvent, requireCustomer } from '@/lib/customer-api';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const ctx = await requireCustomer();
  if ('response' in ctx) return ctx.response;
  const { customer, supabaseAdmin } = ctx;
  const body = await request.json().catch(() => ({}));

  const channel = String(body.channel || 'share').trim().slice(0, 30);
  const friendName = String(body.friend_name || '').trim().slice(0, 80) || null;
  const friendPhone = String(body.friend_phone || '').replace(/\D/g, '').slice(-10) || null;

  await logCustomerEvent(supabaseAdmin, customer.id, 'referral_invite_sent', 'referral', {
    channel,
    friend_name: friendName,
    friend_phone: friendPhone,
    referral_code: String(body.referral_code || '').trim().toUpperCase() || null,
  });

  const { count: totalInvitesSent } = await supabaseAdmin
    .from('customer_analytics_events')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', customer.id)
    .eq('event_name', 'referral_invite_sent');

  return NextResponse.json({
    success: true,
    stats: { total_invites_sent: totalInvitesSent || 0 },
  });
}
