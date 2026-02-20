import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

const RAZORPAY_KEY_ID = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || '';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const amount = Number(body?.amount || 0);
    const customerName = String(body?.customerName || '').trim();
    const customerEmail = body?.customerEmail ? String(body.customerEmail).trim() : null;
    const customerPhone = String(body?.customerPhone || '').trim();
    const linkRef = String(body?.linkRef || '').trim();

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }
    if (!customerName || !customerPhone) {
      return NextResponse.json({ error: 'Customer name and phone are required' }, { status: 400 });
    }
    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      return NextResponse.json({ error: 'Payment gateway not configured' }, { status: 500 });
    }

    if (linkRef) {
      const { supabaseAdmin } = getSupabaseAdmin();
      if (supabaseAdmin) {
        const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const { data: rowsByRef } = await supabaseAdmin
          .from('Razorpay_Direct_pay_RSA')
          .select('status, notes, created_at, updated_at')
          .gte('created_at', since)
          .order('updated_at', { ascending: false })
          .limit(1000);
        const latestForRef = (rowsByRef || [])
          .filter((row: any) => {
            const notes = row?.notes && typeof row.notes === 'object' ? row.notes : {};
            return String((notes as any)?.link_ref || '').trim() === linkRef;
          })
          .sort(
            (a: any, b: any) =>
              new Date(String(b?.updated_at || b?.created_at || 0)).getTime() -
              new Date(String(a?.updated_at || a?.created_at || 0)).getTime()
          )[0];
        const latestStatus = String(latestForRef?.status || '').trim().toUpperCase();
        if (latestStatus === 'CANCELLED') {
          return NextResponse.json(
            { error: 'This payment link has been cancelled by support. Please contact the team for a new link.' },
            { status: 410 }
          );
        }
      }
    }

    const notes: Record<string, string> = {
      purpose: 'PAY_NOW',
    };
    if (linkRef) {
      notes.link_ref = linkRef;
    }

    const amountInPaise = Math.round(amount * 100);
    const orderData = {
      amount: amountInPaise,
      currency: 'INR',
      receipt: `DIRECT_${Date.now()}`,
      notes: {
        purpose: 'PAY_NOW',
        customer_name: customerName,
        customer_email: customerEmail || '',
        customer_phone: customerPhone,
        link_ref: linkRef || '',
      },
    };

    const razorpayResponse = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64')}`,
      },
      body: JSON.stringify(orderData),
    });

    if (!razorpayResponse.ok) {
      const errorData = await razorpayResponse.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData?.error?.description || 'Failed to create Razorpay order' },
        { status: razorpayResponse.status }
      );
    }

    const order = await razorpayResponse.json();

    const { supabaseAdmin, error: adminErr } = getSupabaseAdmin();
    if (supabaseAdmin) {
      const now = new Date().toISOString();
      let saved = false;

      // If telecaller pre-generated this link, convert that placeholder row into a CREATED order row.
      if (linkRef) {
        const placeholderOrderId = `LINK_${linkRef}`;
        const { data: existing } = await supabaseAdmin
          .from('Razorpay_Direct_pay_RSA')
          .select('order_id, notes')
          .eq('order_id', placeholderOrderId)
          .maybeSingle();

        if (existing?.order_id) {
          const existingNotes =
            existing.notes && typeof existing.notes === 'object'
              ? existing.notes
              : {};
          const mergedNotes = {
            ...existingNotes,
            purpose: 'PAY_NOW',
            link_ref: linkRef,
          };
          const { error: updateErr } = await supabaseAdmin
            .from('Razorpay_Direct_pay_RSA')
            .update({
              order_id: order.id,
              amount: amount,
              amount_paise: amountInPaise,
              currency: order.currency || 'INR',
              status: 'CREATED',
              customer_name: customerName,
              customer_email: customerEmail,
              customer_phone: customerPhone,
              notes: mergedNotes,
              razorpay_payload: order,
              updated_at: now,
            })
            .eq('order_id', placeholderOrderId);
          if (!updateErr) {
            saved = true;
          }
        }
      }

      if (!saved) {
        await supabaseAdmin
          .from('Razorpay_Direct_pay_RSA')
          .insert({
            order_id: order.id,
            amount: amount,
            amount_paise: amountInPaise,
            currency: order.currency || 'INR',
            status: 'CREATED',
            customer_name: customerName,
            customer_email: customerEmail,
            customer_phone: customerPhone,
            notes,
            razorpay_payload: order,
            created_at: now,
            updated_at: now,
          });
      }
    } else {
      console.warn('[create-direct-order] Supabase admin missing:', adminErr);
    }
    return NextResponse.json({
      success: true,
      order: {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        receipt: order.receipt || null,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to create payment order' },
      { status: 500 }
    );
  }
}

