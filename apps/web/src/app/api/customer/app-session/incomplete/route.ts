import { NextRequest, NextResponse } from 'next/server';
import { requireCustomer } from '@/lib/customer-api';
import { notifyAppSessionIncompleteWhatsApp } from '@/lib/services/whatsappAutomationJobs';

export const dynamic = 'force-dynamic';

const MAX_SESSION_SECONDS = 10;

export async function POST(request: NextRequest) {
  const ctx = await requireCustomer();
  if ('response' in ctx) return ctx.response;
  const { customer } = ctx;

  const body = await request.json().catch(() => ({}));
  const sessionDurationSec = Number(body?.session_duration_sec ?? body?.duration_sec ?? 0);
  if (!Number.isFinite(sessionDurationSec) || sessionDurationSec <= 0) {
    return NextResponse.json({ error: 'session_duration_sec is required' }, { status: 400 });
  }
  if (sessionDurationSec > MAX_SESSION_SECONDS) {
    return NextResponse.json({ success: true, skipped: true, reason: 'session_too_long' });
  }

  const phone = String(customer.phone || '').trim();
  if (!phone) {
    return NextResponse.json({ success: true, skipped: true, reason: 'missing_phone' });
  }

  const result = await notifyAppSessionIncompleteWhatsApp({
    customerId: customer.id,
    phone,
    customerName: customer.full_name,
    sessionDurationSec,
  });

  return NextResponse.json({ success: true, result });
}
