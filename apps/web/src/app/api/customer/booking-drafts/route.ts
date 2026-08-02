import { NextRequest, NextResponse } from 'next/server';
import { requireCustomer } from '@/lib/customer-api';
import { deriveBookingDraftLabels } from '@/lib/services/bookingIncompleteWhatsApp';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const ctx = await requireCustomer();
  if ('response' in ctx) return ctx.response;
  const { customer, supabaseAdmin } = ctx;

  const body = await request.json().catch(() => ({}));
  const draftKey = String(body?.draft_key || body?.draftKey || '').trim();
  if (!draftKey) {
    return NextResponse.json({ error: 'draft_key is required' }, { status: 400 });
  }

  const payload =
    body?.draft_payload && typeof body.draft_payload === 'object'
      ? body.draft_payload
      : body?.draft && typeof body.draft === 'object'
        ? body.draft
        : {};

  const { carLabel, serviceLabel } = deriveBookingDraftLabels(payload as Record<string, unknown>);
  const now = new Date().toISOString();
  const row = {
    draft_key: draftKey,
    customer_id: customer.id,
    customer_phone: String(customer.phone || payload.customerPhone || '').trim() || null,
    customer_name: String(customer.full_name || payload.customerName || '').trim() || null,
    car_label: carLabel,
    service_label: serviceLabel,
    draft_payload: payload,
    step: Number(body?.step || payload.step || 1) || 1,
    status: 'ACTIVE',
    last_activity_at: now,
    wa_reminder_1_sent_at: null,
    wa_reminder_2_sent_at: null,
    wa_reminder_3_sent_at: null,
    updated_at: now,
  };

  const { data: existing } = await supabaseAdmin
    .from('booking_drafts')
    .select('id')
    .eq('customer_id', customer.id)
    .eq('draft_key', draftKey)
    .maybeSingle();

  const query = existing?.id
    ? supabaseAdmin.from('booking_drafts').update(row).eq('id', existing.id)
    : supabaseAdmin.from('booking_drafts').insert(row);

  const { data, error } = await query.select('id, draft_key, status, last_activity_at').single();

  if (error) {
    return NextResponse.json({ error: error.message || 'Failed to save booking draft' }, { status: 500 });
  }

  return NextResponse.json({ success: true, draft: data });
}

export async function DELETE(request: NextRequest) {
  const ctx = await requireCustomer();
  if ('response' in ctx) return ctx.response;
  const { customer, supabaseAdmin } = ctx;

  const draftKey = String(request.nextUrl.searchParams.get('draft_key') || '').trim();
  if (!draftKey) {
    return NextResponse.json({ error: 'draft_key is required' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from('booking_drafts')
    .update({
      status: 'COMPLETED',
      completed_at: now,
      updated_at: now,
    })
    .eq('customer_id', customer.id)
    .eq('draft_key', draftKey);

  if (error) {
    return NextResponse.json({ error: error.message || 'Failed to complete booking draft' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
