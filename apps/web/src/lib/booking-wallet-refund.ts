import { creditWallet } from '@/lib/wallet-service';

export const BOOKING_CANCEL_REFUND_LABEL = 'Booking cancelled refunded';
export const BOOKING_CANCEL_REFUND_SOURCE = 'BOOKING_CANCEL_REFUND';

export type BookingWalletRefundResult = {
  refunded: boolean;
  amount: number;
  duplicate: boolean;
  reason?: string;
  balance_after?: number;
  lead_id?: string;
};

function asMeta(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return { ...(value as Record<string, unknown>) };
  }
  return {};
}

function refundLabel(leadNumber?: string | null) {
  const number = String(leadNumber || '').trim();
  return number ? `${BOOKING_CANCEL_REFUND_LABEL} · ${number}` : BOOKING_CANCEL_REFUND_LABEL;
}

/**
 * Credits back the wallet amount used on a booking.
 * Safe to call more than once: the credit uses a per-lead idempotency key.
 */
export async function refundWalletOnBookingCancel(
  supabaseAdmin: any,
  leadId: string,
  opts?: { actorUserId?: string | null },
): Promise<BookingWalletRefundResult> {
  const id = String(leadId || '').trim();
  if (!id) return { refunded: false, amount: 0, duplicate: false, reason: 'missing_lead' };

  try {
    const { data: debit, error: debitError } = await supabaseAdmin
      .from('wallet_transactions')
      .select('id, amount, customer_id, metadata, source')
      .eq('idempotency_key', `booking:${id}`)
      .eq('transaction_type', 'DEBIT')
      .maybeSingle();

    if (debitError) {
      return { refunded: false, amount: 0, duplicate: false, reason: debitError.message, lead_id: id };
    }

    const amount = Math.round(Number(debit?.amount || 0) * 100) / 100;
    const customerId = String(debit?.customer_id || '').trim();
    if (!debit || !customerId || amount <= 0) {
      return { refunded: false, amount: 0, duplicate: false, reason: 'no_wallet_used', lead_id: id };
    }

    const { data: lead } = await supabaseAdmin
      .from('service_leads')
      .select('id, lead_number, meta')
      .eq('id', id)
      .maybeSingle();

    const leadNumber = lead?.lead_number ? String(lead.lead_number) : null;
    const debitMeta = asMeta(debit.metadata);
    const label = refundLabel(leadNumber);

    const result = await creditWallet(supabaseAdmin, customerId, amount, {
      source: BOOKING_CANCEL_REFUND_SOURCE,
      idempotencyKey: `booking-cancel-refund:${id}`,
      sourceRefId: id,
      metadata: {
        label,
        lead_id: id,
        lead_number: leadNumber,
        original_debit_id: debit.id,
        service_name: debitMeta.service_name || null,
        actor_user_id: opts?.actorUserId || null,
      },
    });

    if (!result.duplicate) {
      const meta = asMeta(lead?.meta);
      meta.wallet_refunded = true;
      meta.wallet_refunded_at = new Date().toISOString();
      meta.wallet_refund_amount = result.credited;
      meta.wallet_refund_label = label;
      const { error: metaError } = await supabaseAdmin
        .from('service_leads')
        .update({ meta, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (metaError) {
        console.error('[booking-wallet-refund] meta stamp failed', metaError.message);
      }

      const { error: eventError } = await supabaseAdmin.from('customer_analytics_events').insert({
        customer_id: customerId,
        event_name: 'booking_cancelled_refunded',
        event_group: 'wallet',
        properties: {
          amount: result.credited,
          reason: label,
          code: leadNumber,
          lead_id: id,
        },
      });
      if (eventError) {
        console.error('[booking-wallet-refund] activity event failed', eventError.message);
      }
    }

    return {
      refunded: true,
      amount: result.credited,
      duplicate: Boolean(result.duplicate),
      balance_after: result.balance_after,
      lead_id: id,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Wallet refund failed';
    console.error('[booking-wallet-refund]', message);
    return { refunded: false, amount: 0, duplicate: false, reason: message, lead_id: id };
  }
}

export async function refundWalletsForCancelledLeads(
  supabaseAdmin: any,
  leadIds: string[],
  opts?: { actorUserId?: string | null },
) {
  const ids = [...new Set(leadIds.map((id) => String(id || '').trim()).filter(Boolean))];
  const results: BookingWalletRefundResult[] = [];
  for (const leadId of ids) {
    results.push(await refundWalletOnBookingCancel(supabaseAdmin, leadId, opts));
  }
  const refunded = results.filter((row) => row.refunded && !row.duplicate);
  return {
    results,
    refunded_count: refunded.length,
    refunded_amount: Math.round(refunded.reduce((sum, row) => sum + Number(row.amount || 0), 0) * 100) / 100,
  };
}
