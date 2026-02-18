import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || '';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';

function digits10(input: unknown) {
  const raw = String(input ?? '');
  const d = raw.replace(/\D/g, '');
  return d.length <= 10 ? d : d.slice(-10);
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    const user = authData?.user || null;
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await resolveUserProfile(supabase, user);
    if (!profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const roleCode = String((profile.roles as any)?.role_code || '').toUpperCase();
    const allowed = new Set(['RSA_MANAGER', 'SUPER_ADMIN', 'SUB_ADMIN']);
    if (!allowed.has(roleCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      return NextResponse.json({ error: 'Razorpay not configured' }, { status: 500 });
    }

    const body = await request.json().catch(() => ({}));
    const paymentId = String(body?.payment_id || '').trim();
    const mode = String(body?.mode || 'full').trim().toLowerCase();
    const partialAmount = Number(body?.amount || 0);
    const notes = String(body?.notes || '').trim();

    if (!paymentId) {
      return NextResponse.json({ error: 'payment_id is required' }, { status: 400 });
    }
    if (mode !== 'full' && mode !== 'partial') {
      return NextResponse.json({ error: 'mode must be full or partial' }, { status: 400 });
    }
    if (mode === 'partial' && (!Number.isFinite(partialAmount) || partialAmount <= 0)) {
      return NextResponse.json({ error: 'Valid partial refund amount is required' }, { status: 400 });
    }

    const { supabaseAdmin } = getSupabaseAdmin();
    const db = (supabaseAdmin ?? supabase) as any;

    // Ensure this payment belongs to one of manager-assigned leads.
    const { data: paymentRow } = await db
      .from('Razorpay_Direct_pay_RSA')
      .select('payment_id, order_id, customer_phone, amount, amount_paise, currency, status, razorpay_payload')
      .eq('payment_id', paymentId)
      .maybeSingle();

    if (!paymentRow?.payment_id) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    const { data: assignedLeads } = await db
      .from('rsa_leads')
      .select('id, contact_number')
      .eq('assigned_manager_id', profile.id)
      .limit(2000);

    const leadByPhone = new Map<string, any>();
    const assignedPhones = new Set<string>();
    for (const lead of assignedLeads || []) {
      const phone = digits10(lead?.contact_number);
      if (!phone) continue;
      assignedPhones.add(phone);
      if (!leadByPhone.has(phone)) {
        leadByPhone.set(phone, lead);
      }
    }
    const paymentPhone = digits10(paymentRow.customer_phone);
    if (!paymentPhone || !assignedPhones.has(paymentPhone)) {
      return NextResponse.json({ error: 'You can refund only your assigned lead payments' }, { status: 403 });
    }
    const linkedLead = leadByPhone.get(paymentPhone) || null;

    // Pull live payment details from Razorpay to enforce refundable amount.
    const paymentResp = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, {
      method: 'GET',
      headers: {
        Authorization: `Basic ${Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64')}`,
      },
    });
    const paymentJson = await paymentResp.json().catch(() => ({}));
    if (!paymentResp.ok) {
      return NextResponse.json(
        { error: paymentJson?.error?.description || 'Failed to fetch payment from Razorpay' },
        { status: paymentResp.status || 500 }
      );
    }

    const capturedPaise = Number(paymentJson?.amount || 0);
    const refundedPaise = Number(paymentJson?.amount_refunded || 0);
    const refundablePaise = Math.max(0, capturedPaise - refundedPaise);
    if (refundablePaise <= 0) {
      return NextResponse.json({ error: 'No refundable amount left for this payment' }, { status: 400 });
    }

    let refundPaise = refundablePaise;
    if (mode === 'partial') {
      refundPaise = Math.round(partialAmount * 100);
      if (refundPaise <= 0) {
        return NextResponse.json({ error: 'Invalid partial refund amount' }, { status: 400 });
      }
      if (refundPaise > refundablePaise) {
        return NextResponse.json(
          { error: `Partial amount exceeds refundable amount ₹${(refundablePaise / 100).toFixed(2)}` },
          { status: 400 }
        );
      }
    }

    const refundBody: any = {
      amount: refundPaise,
      speed: 'optimum',
      notes: {
        source: 'rsa_manager_payments',
        refunded_by_profile_id: String(profile.id || ''),
        refunded_by_role: roleCode,
      },
    };
    if (notes) refundBody.notes.reason = notes;

    const refundResp = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}/refund`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64')}`,
      },
      body: JSON.stringify(refundBody),
    });
    const refundJson = await refundResp.json().catch(() => ({}));
    if (!refundResp.ok) {
      return NextResponse.json(
        { error: refundJson?.error?.description || 'Razorpay refund failed' },
        { status: refundResp.status || 500 }
      );
    }

    const newRefundedPaise = refundedPaise + refundPaise;
    const nextStatus = newRefundedPaise >= capturedPaise ? 'REFUNDED' : 'PARTIALLY_REFUNDED';

    const updatedPayload = {
      ...(paymentRow?.razorpay_payload && typeof paymentRow.razorpay_payload === 'object' ? paymentRow.razorpay_payload : {}),
      last_refund: refundJson,
      amount_refunded: newRefundedPaise,
      amount_captured: capturedPaise,
      refund_updated_at: new Date().toISOString(),
    };

    const nowIso = new Date().toISOString();
    await db
      .from('Razorpay_Direct_pay_RSA')
      .update({
        status: nextStatus,
        razorpay_payload: updatedPayload,
        updated_at: nowIso,
      })
      .eq('payment_id', paymentId);

    if (linkedLead?.id) {
      const mappedLeadStatus = nextStatus === 'REFUNDED' ? 'cancelled' : 'completed';
      const refundLabel = nextStatus === 'REFUNDED' ? 'full refund' : 'partial refund';
      const refundNote = notes
        ? `${refundLabel} processed via payment ${paymentId}. Note: ${notes}`
        : `${refundLabel} processed via payment ${paymentId}.`;

      await db
        .from('rsa_leads')
        .update({
          lead_status: mappedLeadStatus,
          complaint_status: mappedLeadStatus,
          updated_at: nowIso,
        })
        .eq('id', linkedLead.id);

      await db
        .from('rsa_lead_timeline')
        .insert({
          lead_id: linkedLead.id,
          status: nextStatus === 'REFUNDED' ? 'refund_full' : 'refund_partial',
          status_description: refundNote,
          updated_by_id: user.id,
          updated_by_name: String(profile?.full_name || profile?.name || user.email || '').trim() || null,
          updated_at: nowIso,
          created_at: nowIso,
        });
    }

    return NextResponse.json(
      {
        success: true,
        refund: {
          id: refundJson?.id || null,
          amount: refundPaise / 100,
          currency: paymentJson?.currency || 'INR',
          status: refundJson?.status || null,
          payment_status: nextStatus,
          payment_id: paymentId,
          mode,
        },
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 });
  }
}
