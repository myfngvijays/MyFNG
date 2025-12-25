import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';

function toNumber(v: any): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_ADMIN_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return { supabaseAdmin: null as any, error: 'Missing Supabase service role key/URL' };
  }

  const supabaseAdmin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { supabaseAdmin, error: null as string | null };
}

function ensureInvoiceNumber() {
  const suffix = Date.now().toString().slice(-8);
  return `INV-${suffix}`;
}

export type ChatInvoice = {
  id: string;
  invoice_number: string;
  lead_id: string;
  total_amount: number;
  final_amount: number;
  paid_amount: number;
  payment_status: string | null;
  status: string | null;
};

/**
 * Ensure an invoice exists for a lead, and optionally set it to a specific payable amount.
 * This is used to support chatbot payments (booking token / advance / invoice) without inventing prices.
 */
export async function ensureInvoiceForLead(params: {
  leadId: string;
  // If provided, invoice amounts will be set (or kept if already higher and already paid partially).
  desiredAmount?: number | null;
  // Short label for line_items/invoice_notes
  purpose?: 'BOOKING_TOKEN' | 'ADVANCE' | 'INVOICE';
}): Promise<ChatInvoice> {
  const { supabaseAdmin, error } = getAdminClient();
  if (!supabaseAdmin) throw new Error(error || 'Supabase admin client not configured');

  const now = new Date().toISOString();
  const desired = toNumber(params.desiredAmount);

  // Check existing invoice for lead
  const { data: existing } = await supabaseAdmin
    .from('invoices')
    .select('id, invoice_number, lead_id, total_amount, final_amount, paid_amount, payment_status, status')
    .eq('lead_id', params.leadId)
    .maybeSingle();

  if (existing?.id) {
    // Optionally adjust amounts upward if needed and safe.
    if (desired > 0) {
      const paid = toNumber((existing as any).paid_amount);
      const currentFinal = toNumber((existing as any).final_amount) || toNumber((existing as any).total_amount);
      // Never reduce below paid amount.
      const nextFinal = Math.max(paid, desired, currentFinal);
      if (nextFinal !== currentFinal) {
        await supabaseAdmin
          .from('invoices')
          .update({
            final_amount: nextFinal,
            total_amount: nextFinal,
            balance_due: Math.max(0, nextFinal - paid),
            status: (existing as any).status || 'AWAITING_PAYMENT',
            updated_at: now,
            invoice_notes: params.purpose ? `Chat payment flow: ${params.purpose}` : (existing as any).invoice_notes || null,
          })
          .eq('id', (existing as any).id);
      }
    }

    return {
      id: (existing as any).id,
      invoice_number: (existing as any).invoice_number,
      lead_id: (existing as any).lead_id,
      total_amount: toNumber((existing as any).total_amount),
      final_amount: toNumber((existing as any).final_amount),
      paid_amount: toNumber((existing as any).paid_amount),
      payment_status: (existing as any).payment_status || null,
      status: (existing as any).status || null,
    };
  }

  // Create new invoice
  const invoiceNumber = ensureInvoiceNumber();
  const amount = desired > 0 ? desired : 0;

  const { data: created, error: createErr } = await supabaseAdmin
    .from('invoices')
    .insert({
      lead_id: params.leadId,
      invoice_number: invoiceNumber,
      base_amount: amount,
      extra_charges: 0,
      discount: 0,
      tax_amount: 0,
      total_amount: amount,
      final_amount: amount,
      paid_amount: 0,
      balance_due: amount,
      payment_status: amount > 0 ? 'PENDING' : 'PENDING',
      status: 'AWAITING_PAYMENT',
      invoice_date: new Date().toISOString().slice(0, 10),
      invoice_notes: params.purpose ? `Chat payment flow: ${params.purpose}` : 'Chat payment flow',
      line_items:
        amount > 0
          ? [
              {
                description: params.purpose === 'BOOKING_TOKEN' ? 'Booking token' : 'Service payment',
                qty: 1,
                rate: amount,
                amount,
              },
            ]
          : [],
      created_at: now,
      updated_at: now,
    })
    .select('id, invoice_number, lead_id, total_amount, final_amount, paid_amount, payment_status, status')
    .single();

  if (createErr || !created?.id) {
    throw new Error(createErr?.message || 'Failed to create invoice');
  }

  return {
    id: (created as any).id,
    invoice_number: (created as any).invoice_number,
    lead_id: (created as any).lead_id,
    total_amount: toNumber((created as any).total_amount),
    final_amount: toNumber((created as any).final_amount),
    paid_amount: toNumber((created as any).paid_amount),
    payment_status: (created as any).payment_status || null,
    status: (created as any).status || null,
  };
}


