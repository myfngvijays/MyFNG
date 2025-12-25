import { createClient } from '@/lib/supabase/server';
import type { ChatPaymentType } from '@/app/api/chatbot/types';

export type ResolvedPayable = {
  paymentType: ChatPaymentType;
  // Human readable label for chat copy only (no business logic)
  label: string;
  // Amount in INR (rupees)
  amount: number;
  currency: 'INR';
  // Required linkage for downstream tables
  leadId?: string | null;
  invoiceId?: string | null;
  invoiceNumber?: string | null;
  // Extra context to store in payment_intents.metadata
  metadata?: Record<string, any>;
};

function toNumber(v: any): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

async function getSettingNumber(key: string): Promise<number | null> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', key)
      .maybeSingle();
    const raw = (data as any)?.setting_value;
    const n = toNumber(raw);
    return n > 0 ? n : null;
  } catch {
    return null;
  }
}

export async function resolveBookingTokenAmount(): Promise<number> {
  const fromSettings = await getSettingNumber('BOOKING_TOKEN_AMOUNT');
  if (fromSettings) return fromSettings;
  const env = toNumber(process.env.BOOKING_TOKEN_AMOUNT);
  if (env > 0) return env;
  return 99;
}

/**
 * Resolve payable amount + linkage for the three payment types.
 * NOTE: We never compute service pricing here. We only use system-stored amounts.
 */
export async function resolvePayable(params: {
  paymentType: ChatPaymentType;
  leadId?: string | null;
  invoiceId?: string | null;
  // Optional override (used for advance / partial payments)
  amountOverride?: number | null;
}): Promise<ResolvedPayable> {
  const { paymentType } = params;

  if (paymentType === 'BOOKING_TOKEN') {
    const amount = await resolveBookingTokenAmount();
    return {
      paymentType,
      label: 'Booking token',
      amount,
      currency: 'INR',
      leadId: params.leadId || null,
      invoiceId: params.invoiceId || null,
      metadata: { kind: 'booking_token' },
    };
  }

  if (paymentType === 'ADVANCE') {
    const amt = toNumber(params.amountOverride);
    if (amt <= 0) {
      // Advance amount must be explicitly provided by ops/estimate flow.
      // Chatbot should ask for confirmation or offer callback.
      throw new Error('Advance amount not available');
    }
    return {
      paymentType,
      label: 'Advance payment',
      amount: amt,
      currency: 'INR',
      leadId: params.leadId || null,
      invoiceId: params.invoiceId || null,
      metadata: { kind: 'advance' },
    };
  }

  // INVOICE payment
  if (!params.invoiceId) {
    throw new Error('Invoice ID required');
  }
  return {
    paymentType,
    label: 'Invoice payment',
    amount: 0, // server will compute remaining amount from invoice safely
    currency: 'INR',
    leadId: params.leadId || null,
    invoiceId: params.invoiceId,
    metadata: { kind: 'invoice' },
  };
}


