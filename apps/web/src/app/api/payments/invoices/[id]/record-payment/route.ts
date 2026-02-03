/**
 * Record Payment API
 * Step 6: Collect Payment - Record cash/POS/other offline payments
 */

import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { createFinanceEvent } from '@/lib/services/financeEventService';
import { createNotification, notifyCSETeam, notifyTelecallerTeamlead, notifyWorkshopRoles } from '@/lib/notifications';
import { calculateTaxes, generateSeriesDocumentNumber, getPlaceOfSupply, roundOff } from '@/lib/utils/invoiceUtils';
import type { Database } from '@/types/database';

function normalizeDiscountMode(mode: any): 'AMOUNT' | 'PERCENT' | null {
  const m = String(mode ?? '').trim().toUpperCase();
  if (!m) return null;
  if (m === 'AMOUNT' || m === 'FLAT' || m === 'FIXED' || m === 'VALUE') return 'AMOUNT';
  if (m === 'PERCENT' || m === 'PERCENTAGE' || m === 'PCT') return 'PERCENT';
  return null;
}

function parseDiscountFromDescription(desc: any): { mode: 'AMOUNT' | 'PERCENT' | null; value: number | null } {
  const s = String(desc ?? '').trim();
  if (!s) return { mode: null, value: null };
  const percentMatch = s.match(/(\d+(?:\.\d+)?)\s*%/);
  if (percentMatch) {
    const v = Number(percentMatch[1]);
    return { mode: 'PERCENT', value: Number.isFinite(v) ? v : null };
  }
  const numMatch = s.match(/(\d+(?:\.\d+)?)/);
  if (numMatch) {
    const v = Number(numMatch[1]);
    return { mode: 'AMOUNT', value: Number.isFinite(v) ? v : null };
  }
  return { mode: null, value: null };
}

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!supabaseUrl || !serviceRoleKey) return { supabaseAdmin: null as any, error: 'SUPABASE_SERVICE_ROLE_KEY not set' };
  const supabaseAdmin = createSupabaseAdminClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { supabaseAdmin, error: null as any };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { supabaseAdmin, error: adminError } = getAdminClient();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: adminError }, { status: 500 });
    }
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Robust profile lookup (email/phone/id) + role_code
    const email = (user.email || '').trim();
    const phone = (user.phone || '').trim();
    const selectProfile = 'id, email, phone, workshop_id, full_name, roles!inner(role_code)';

    const { data: byEmail } = email
      ? await supabase.from('users_login').select(selectProfile).ilike('email', email).maybeSingle()
      : { data: null };
    const { data: byPhone } = !byEmail && phone
      ? await supabase.from('users_login').select(selectProfile).eq('phone', phone).maybeSingle()
      : { data: null };
    const { data: byId } = !byEmail && !byPhone
      ? await supabase.from('users_login').select(selectProfile).eq('id', user.id).maybeSingle()
      : { data: null };

    const userProfile: any = byEmail || byPhone || byId;
    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const roleCode = (userProfile.roles as any)?.role_code;
    const allowedRoleCodes = ['SUPER_ADMIN', 'SUB_ADMIN', 'WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR'];
    if (!allowedRoleCodes.includes(roleCode)) {
      return NextResponse.json({ error: 'Forbidden', role: roleCode }, { status: 403 });
    }

    const { id: invoiceId } = await params;

    // Get invoice details
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('*, lead:service_leads!lead_id(*)')
      .eq('id', invoiceId)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // NEW FLOW: payments must be collected against CUSTOMER_INVOICE (CI)
    if ((invoice as any).invoice_type === 'ORDER_SUMMARY') {
      return NextResponse.json(
        {
          error: 'Cannot record payment against Order Summary',
          hint: 'Finalize and confirm Customer Invoice (CI), then record payment against CI.',
        },
        { status: 400 }
      );
    }

    // Prevent edits after archival/closure
    if (invoice.lead?.read_only) {
      return NextResponse.json({
        error: 'Lead is archived/read-only',
        hint: 'This lead is closed and payments cannot be modified'
      }, { status: 400 });
    }

    // Verify invoice is ready for payment
    // Some installs use legacy statuses like GENERATED / PENDING.
    const invoiceStatus = String((invoice as any).status || '').trim().toUpperCase();
    const allowedInvoiceStatuses = ['APPROVED', 'AWAITING_PAYMENT', 'INVOICE_GENERATED', 'GENERATED', 'PENDING', 'PARTIAL'];
    if (invoiceStatus && !allowedInvoiceStatuses.includes(invoiceStatus)) {
      return NextResponse.json({ 
        error: 'Invoice not ready for payment',
        current_status: (invoice as any).status,
      }, { status: 400 });
    }

    const body = await request.json();
    const {
      payment_mode, // CASH, POS, UPI, CARD, WALLET, NETBANKING, COD
      paid_amount,
      payment_txn_id,
      payment_reference,
      payment_remarks,
      staff_name,
      is_cod = false,
      cod_due_date,
      cash_deposit_pending = false,
      bank_deposit_slip_url,
    } = body;

    if (!payment_mode || !paid_amount) {
      return NextResponse.json({ 
        error: 'Payment mode and amount are required' 
      }, { status: 400 });
    }

    // For offline modes, require audit-friendly remarks
    if (!is_cod && ['CASH', 'POS', 'UPI', 'CARD', 'NETBANKING', 'WALLET'].includes(String(payment_mode).toUpperCase())) {
      if (!payment_remarks || String(payment_remarks).trim().length < 3) {
        return NextResponse.json(
          { error: 'payment_remarks is required for offline payments' },
          { status: 400 }
        );
      }
      if (!staff_name || String(staff_name).trim().length < 2) {
        return NextResponse.json(
          { error: 'staff_name is required for offline payments' },
          { status: 400 }
        );
      }
    }

    const toNum = (v: any) => {
      const n = typeof v === 'number' ? v : parseFloat(String(v ?? '0'));
      return Number.isFinite(n) ? n : 0;
    };

    const paidAmount = toNum(paid_amount);
    let finalAmountNum = toNum((invoice as any).final_amount);
    let totalAmountNum = toNum((invoice as any).total_amount);
    let storedSubTotalNum = toNum((invoice as any).sub_total ?? (invoice as any).subtotal);
    let storedDiscountNum = toNum((invoice as any).discount_amount);
    const storedRoundOffNum = toNum((invoice as any).round_off_amount);
    const storedTaxNum =
      toNum((invoice as any).total_tax) ||
      (toNum((invoice as any).cgst_amount) + toNum((invoice as any).sgst_amount) + toNum((invoice as any).igst_amount));

    // Compute from line_items (most reliable when DB totals are stale)
    const li = Array.isArray((invoice as any).line_items) ? ((invoice as any).line_items as any[]) : [];
    const lineItemsTotal = li.reduce((s: number, x: any) => {
      const amt = toNum(x?.amount);
      if (amt > 0) return s + amt;
      const qty = toNum(x?.qty ?? 1) || 1;
      const rate = toNum(x?.rate);
      return s + (rate * qty);
    }, 0);

    // If coupon is present but invoice discount wasn't persisted yet, compute + persist it here
    // so that payable comparisons (and TI generation) use the correct discounted payable.
    const couponCode = String((invoice as any).coupon_code || (invoice as any).lead?.coupon_code || '').trim();
    const subTotalPreDiscount = storedSubTotalNum || lineItemsTotal;
    try {
      if (couponCode && storedDiscountNum <= 0 && subTotalPreDiscount > 0) {
        const { data: coupon } = await supabaseAdmin
          .from('coupons')
          .select('*')
          .ilike('code', couponCode.toUpperCase())
          .eq('is_active', true)
          .maybeSingle();

        if (coupon && String((coupon as any).coupon_kind || '').toUpperCase() === 'TOTAL_DISCOUNT') {
          const derived = parseDiscountFromDescription((coupon as any).description);
          const mode =
            normalizeDiscountMode((coupon as any).discount_mode) ||
            normalizeDiscountMode((coupon as any).mode) ||
            normalizeDiscountMode((coupon as any).discount_type) ||
            derived.mode;
          const valueRaw =
            (coupon as any).discount_value ??
            (coupon as any).value ??
            (coupon as any).amount ??
            (coupon as any).discount ??
            (coupon as any).amount_off ??
            (coupon as any).percent_off ??
            derived.value;
          const value = Number(valueRaw);
          const minOrder = Number((coupon as any).min_order_value || 0) || 0;
          if (minOrder > 0 && subTotalPreDiscount < minOrder) {
            // not applicable; skip
          } else if (mode && Number.isFinite(value) && value > 0) {
            const computedDiscount = mode === 'AMOUNT' ? Math.min(value, subTotalPreDiscount) : (subTotalPreDiscount * value) / 100;
            if (computedDiscount > 0) {
              const storedPayable0 = Math.max(finalAmountNum, totalAmountNum, 0);
              const looksPreDiscount = storedPayable0 > 0 && Math.abs(storedPayable0 - subTotalPreDiscount) < 0.5;
              if (looksPreDiscount) {
                const netRaw = Math.max(0, subTotalPreDiscount - computedDiscount);
                const netRounded = roundOff(netRaw);
                const roundOffAdj = parseFloat((netRounded - netRaw).toFixed(2));
                const discountPct = subTotalPreDiscount > 0 ? (computedDiscount / subTotalPreDiscount) * 100 : 0;
                const couponMeta = {
                  coupon_id: (coupon as any).id,
                  code: (coupon as any).code,
                  coupon_kind: (coupon as any).coupon_kind,
                  discount_mode: (coupon as any).discount_mode,
                  discount_value: (coupon as any).discount_value,
                  min_order_value: (coupon as any).min_order_value,
                  discount_amount: Number(computedDiscount || 0),
                  computed_on_subtotal: subTotalPreDiscount,
                  validated_at: new Date().toISOString(),
                };

                await supabaseAdmin
                  .from('invoices')
                  .update({
                    sub_total: subTotalPreDiscount,
                    subtotal: subTotalPreDiscount,
                    discount_amount: computedDiscount,
                    discount_percentage: discountPct,
                    coupon_meta: couponMeta,
                    round_off_amount: roundOffAdj,
                    final_amount: netRounded,
                    total_amount: netRounded,
                    updated_at: new Date().toISOString(),
                  } as any)
                  .eq('id', invoiceId);

                // Update local variables used for payable calculation
                storedSubTotalNum = subTotalPreDiscount;
                storedDiscountNum = computedDiscount;
                finalAmountNum = netRounded;
                totalAmountNum = netRounded;
              }
            }
          }
        }
      }
    } catch {
      // non-blocking: keep old values
    }

    // Best-effort recompute taxes if stored taxes are missing/incorrect
    let computedTax = storedTaxNum;
    let computedRoundOff = storedRoundOffNum;
    let computedSubTotal = storedSubTotalNum || lineItemsTotal;
    try {
      const leadAny: any = (invoice as any).lead || {};
      // Fetch workshop state for place-of-supply decision
      let workshop: any = null;
      try {
        const { data: w } = await supabaseAdmin
          .from('workshops')
          .select('state, state_code')
          .eq('id', (invoice as any).workshop_id)
          .maybeSingle();
        workshop = w;
      } catch {
        workshop = null;
      }

      const customerState = leadAny.customer_state || leadAny.state || '';
      const customerStateCode = leadAny.customer_state_code || leadAny.state_code || '';
      const workshopState = workshop?.state || '';
      const workshopStateCode = workshop?.state_code || '';
      const place = getPlaceOfSupply(customerState, customerStateCode, workshopState, workshopStateCode);

      // Prefer line_items total for taxable base if available
      const netTaxable = Math.max(0, (lineItemsTotal || computedSubTotal) - storedDiscountNum);
      const taxes = calculateTaxes(netTaxable, place.useIGST);
      computedTax = taxes.totalTax;
      const preRoundTotal = netTaxable + taxes.totalTax;
      const rounded = roundOff(preRoundTotal);
      computedRoundOff = parseFloat((rounded - preRoundTotal).toFixed(2));
    } catch {
      // ignore; keep stored tax/roundOff
    }

    // Derived totals (fallbacks)
    const derivedPayableStored = Math.max(0, computedSubTotal - storedDiscountNum + storedTaxNum + storedRoundOffNum);
    const derivedPayableComputed = Math.max(0, lineItemsTotal - storedDiscountNum + computedTax + computedRoundOff);

    // IMPORTANT:
    // Customer-facing payable must follow stored invoice.final_amount when present.
    // Using a "max" across sources can incorrectly mark a fully-paid invoice as PARTIAL,
    // which prevents TI generation. Fallback only if stored totals are missing/zero.
    const storedPayable = Math.max(finalAmountNum, totalAmountNum, 0);
    const invoiceAmount =
      storedPayable > 0
        ? storedPayable
        : Math.max(derivedPayableStored, derivedPayableComputed, 0);
    const currentPaidAmount = toNum((invoice as any).paid_amount);
    const balanceDue = Math.max(0, invoiceAmount - currentPaidAmount);

    if (paidAmount <= 0) {
      return NextResponse.json({ 
        error: 'Payment amount must be greater than 0' 
      }, { status: 400 });
    }

    if (paidAmount > balanceDue) {
      return NextResponse.json({ 
        error: 'Payment amount exceeds balance due',
        balance_due: balanceDue,
        provided_amount: paidAmount,
        invoice_amount: invoiceAmount,
        invoice_final_amount: finalAmountNum,
        invoice_total_amount: totalAmountNum,
        invoice_derived_payable: derivedPayableComputed,
      }, { status: 400 });
    }

    // Check for duplicate transaction (use admin client to bypass RLS)
    if (payment_txn_id || payment_reference) {
      const txnRef = payment_txn_id || payment_reference;
      const { data: existingTxn } = await supabaseAdmin
        .from('payment_transactions')
        .select('id, transaction_id, amount')
        .or(`transaction_id.eq.${txnRef},gateway_payment_id.eq.${txnRef}`)
        .eq('status', 'SUCCESS')
        .order('initiated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingTxn) {
        return NextResponse.json({
          error: 'Duplicate transaction detected',
          existing_transaction: existingTxn,
        }, { status: 409 });
      }
    }

    const now = new Date().toISOString();
    const transactionId = payment_txn_id || `TXN-${Date.now()}-${invoiceId.substring(0, 8)}`;
    
    // Calculate new totals
    const newPaidAmount = currentPaidAmount + paidAmount;
    const newBalanceDue = Math.max(0, invoiceAmount - newPaidAmount);
    const isFullPayment = newPaidAmount + 0.01 >= invoiceAmount;

    // Create payment transaction record
    const { data: paymentTransaction, error: transactionError } = await supabaseAdmin
      .from('payment_transactions')
      .insert({
        transaction_id: transactionId,
        invoice_id: invoiceId,
        lead_id: invoice.lead_id,
        amount: paidAmount,
        currency: 'INR',
        payment_method: payment_mode,
        payment_gateway: payment_mode === 'CASH' || payment_mode === 'POS' ? 'OFFLINE' : null,
        gateway_payment_id: payment_reference,
        gateway_order_id: payment_txn_id,
        status: is_cod ? 'COD_PENDING' : 'SUCCESS',
        completed_at: is_cod ? null : now,
        payment_received_by: userProfile.id,
        payment_remarks: payment_remarks || `Payment received via ${payment_mode}`,
        staff_name: staff_name || userProfile.full_name,
        cash_deposit_pending: payment_mode === 'CASH' ? (cash_deposit_pending || false) : false,
        notes: is_cod ? `COD - Due date: ${cod_due_date || 'TBD'}` : undefined,
        created_by: userProfile.id,
        created_at: now,
      })
      .select()
      .single();

    if (transactionError) {
      console.error('Error creating payment transaction:', transactionError);
      return NextResponse.json(
        { error: 'Failed to record payment', details: transactionError.message, code: transactionError.code, hint: transactionError.hint },
        { status: 500 }
      );
    }

    // Update invoice
    const updateData: any = {
      payment_status: isFullPayment ? 'PAID' : 'PARTIAL',
      paid_amount: newPaidAmount,
      balance_due: newBalanceDue,
      payment_mode: payment_mode,
      payment_txn_id: transactionId,
      payment_received_by: userProfile.id,
      payment_remarks: payment_remarks || `Payment received via ${payment_mode} by ${staff_name || userProfile.full_name}`,
      payment_collected_at: now,
      status: isFullPayment ? 'PAID' : (is_cod ? 'COD_PENDING' : 'PARTIAL'),
      updated_at: now,
    };

    if (isFullPayment && !is_cod) {
      updateData.paid_at = now;
    }

    if (is_cod) {
      updateData.cod_due_date = cod_due_date;
    }

    const { data: updatedInvoice, error: updateError } = await supabaseAdmin
      .from('invoices')
      .update(updateData)
      .eq('id', invoiceId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating invoice:', updateError);
      return NextResponse.json({ error: 'Failed to update invoice' }, { status: 500 });
    }

    // Create finance event (best-effort; never fail payment recording)
    try {
      await createFinanceEvent({
        eventType: is_cod ? 'payment_received' : (isFullPayment ? 'payment_received' : 'payment_partial'),
        entityType: 'payment',
        entityId: paymentTransaction.id,
        actorId: userProfile.id,
        actorRole: roleCode,
        actorName: userProfile.full_name,
        eventData: {
          invoice_id: invoiceId,
          invoice_number: invoice.invoice_number,
          payment_mode: payment_mode,
          amount: paidAmount,
          is_cod: is_cod,
          is_partial: !isFullPayment,
          transaction_id: transactionId,
        },
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
      });
    } catch (e) {
      console.warn('createFinanceEvent failed (non-blocking):', e);
    }

    // Update lead status
    let taxInvoice: any = null;
    if (invoice.lead_id) {
      // After full payment, the vehicle becomes eligible for delivery.
      // Delivery flows (pickup boy / supervisor dashboards) key off READY_FOR_DELIVERY (or COD_PENDING).
      const newLeadStatus = is_cod 
        ? 'COD_PENDING'
        : isFullPayment 
        ? 'READY_FOR_DELIVERY' 
        : 'PARTIAL_PAYMENT';
      
      // IMPORTANT: schema tolerance
      // Some installs do not have payment_* columns on service_leads (or custom triggers can reject multi-column updates).
      // We always try to update `status` first (so delivery eligibility works), then best-effort update payment fields.
      const { error: statusOnlyErr } = await supabaseAdmin
        .from('service_leads')
        .update({ status: newLeadStatus, updated_at: now } as any)
        .eq('id', invoice.lead_id);
      if (statusOnlyErr) {
        console.warn('Non-blocking: failed to update lead status after payment:', statusOnlyErr);
      }

      const { error: paymentFieldsErr } = await supabaseAdmin
        .from('service_leads')
        .update(
          {
            payment_status: is_cod ? 'COD_PENDING' : (isFullPayment ? 'PAID' : 'PARTIAL'),
            payment_mode: payment_mode,
            payment_txn_id: transactionId,
            payment_collected_at: now,
            updated_at: now,
          } as any
        )
        .eq('id', invoice.lead_id);
      if (paymentFieldsErr) {
        console.warn('Non-blocking: failed to update lead payment fields after payment:', paymentFieldsErr);
      }

      // On full payment (non-COD), generate Tax Invoice (TI) using same series suffix
      if (isFullPayment && !is_cod) {
        // Determine shared series (prefer invoice/lead columns, then parse CI/OS invoice_number)
        const parseSeriesFromNumber = (num: any) => {
          const s = String(num || '').trim().toUpperCase();
          const m = s.match(/^(OS|CI|TI)-(\d{4})-(\d{2})-(\d{1,})$/);
          if (!m) return null;
          return { year: parseInt(m[2], 10), month: parseInt(m[3], 10), seq: parseInt(m[4], 10) };
        };

        let year =
          (updatedInvoice as any)?.series_year ||
          (invoice as any).series_year ||
          (invoice.lead as any)?.invoice_series_year ||
          null;
        let month =
          (updatedInvoice as any)?.series_month ||
          (invoice as any).series_month ||
          (invoice.lead as any)?.invoice_series_month ||
          null;
        let seq =
          (updatedInvoice as any)?.series_seq ||
          (invoice as any).series_seq ||
          (invoice.lead as any)?.invoice_series_seq ||
          null;

        if (!year || !month || !seq) {
          const parsed = parseSeriesFromNumber((invoice as any).invoice_number);
          if (parsed) {
            year = year || parsed.year;
            month = month || parsed.month;
            seq = seq || parsed.seq;
          }
        }

        if (year && month && seq) {
          const tiNumber = generateSeriesDocumentNumber('TI', year, month, seq);

          const { data: existingTI } = await supabaseAdmin
            .from('invoices')
            .select('*')
            .eq('lead_id', invoice.lead_id)
            .eq('invoice_type', 'TAX_INVOICE')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (existingTI?.id) {
            taxInvoice = existingTI;
          } else {
            const amount = parseFloat(String((updatedInvoice as any)?.final_amount || invoiceAmount || '0')) || 0;
            const tiPayload: any = {
              invoice_number: tiNumber,
              lead_id: invoice.lead_id,
              workshop_id: (updatedInvoice as any).workshop_id || (invoice as any).workshop_id,
              base_amount: (updatedInvoice as any).base_amount || (invoice as any).base_amount || 0,
              parts_cost: (updatedInvoice as any).parts_cost || (invoice as any).parts_cost || 0,
              extra_charges: (updatedInvoice as any).extra_charges || (invoice as any).extra_charges || 0,
              labour_cost: (updatedInvoice as any).labour_cost || (invoice as any).labour_cost || 0,
              sub_total: (updatedInvoice as any).sub_total || (updatedInvoice as any).subtotal || (invoice as any).sub_total || 0,
              discount_amount: (updatedInvoice as any).discount_amount || (invoice as any).discount_amount || 0,
              cgst_percentage: (updatedInvoice as any).cgst_percentage || (invoice as any).cgst_percentage || 0,
              cgst_amount: (updatedInvoice as any).cgst_amount || (invoice as any).cgst_amount || 0,
              sgst_percentage: (updatedInvoice as any).sgst_percentage || (invoice as any).sgst_percentage || 0,
              sgst_amount: (updatedInvoice as any).sgst_amount || (invoice as any).sgst_amount || 0,
              igst_percentage: (updatedInvoice as any).igst_percentage || (invoice as any).igst_percentage || 0,
              igst_amount: (updatedInvoice as any).igst_amount || (invoice as any).igst_amount || 0,
              total_tax: (updatedInvoice as any).total_tax || (invoice as any).total_tax || 0,
              round_off_amount: (updatedInvoice as any).round_off_amount || (invoice as any).round_off_amount || 0,
              final_amount: amount,
              amount_in_words: (updatedInvoice as any).amount_in_words || (invoice as any).amount_in_words || null,
              place_of_supply: (updatedInvoice as any).place_of_supply || (invoice as any).place_of_supply || null,
              place_of_supply_state_code:
                (updatedInvoice as any).place_of_supply_state_code || (invoice as any).place_of_supply_state_code || null,
              status: 'PAID',
              payment_status: 'PAID',
              paid_amount: amount,
              payment_mode: payment_mode,
              payment_txn_id: transactionId,
              paid_at: now,
              generated_by: userProfile.id,
              invoice_type: 'TAX_INVOICE',
              series_year: year,
              series_month: month,
              series_seq: seq,
              visible_to_customer: true,
              show_gst_breakup: true,
              line_items: (updatedInvoice as any).line_items || (invoice as any).line_items || [],
              created_at: now,
              updated_at: now,
            };

            const { data: createdTI, error: tiErr } = await supabaseAdmin
              .from('invoices')
              .insert(tiPayload)
              .select('*')
              .single();

            if (tiErr) {
              console.error('TI creation failed (non-blocking):', tiErr);
            } else {
              taxInvoice = createdTI;
            }
          }

          if (taxInvoice?.id) {
            // Some installs don't have `invoice_number` on leads; keep this schema-tolerant.
            const { error: invRefErr1 } = await supabaseAdmin
              .from('service_leads')
              .update({ invoice_id: taxInvoice.id, updated_at: now } as any)
              .eq('id', invoice.lead_id);
            if (invRefErr1) console.warn('Non-blocking: failed to update lead.invoice_id:', invRefErr1);

            const { error: invRefErr2 } = await supabaseAdmin
              .from('service_leads')
              .update({ invoice_number: taxInvoice.invoice_number, updated_at: now } as any)
              .eq('id', invoice.lead_id);
            if (invRefErr2) console.warn('Non-blocking: failed to update lead.invoice_number:', invRefErr2);
          }
        } else {
          console.warn('TI not generated: missing series (year/month/seq).', {
            year,
            month,
            seq,
            invoice_number: (invoice as any).invoice_number,
          });
        }
      }

      // Fallback: if TI insert failed due to schema/policy mismatch, use the dedicated ensure-tax-invoice API.
      // This API contains GST-inclusive (back-calculation) logic and more robust error reporting.
      if (isFullPayment && !is_cod && !taxInvoice?.id) {
        try {
          const cookie = request.headers.get('cookie') || '';
          const authorization = request.headers.get('authorization') || '';
          const ensureUrl = `${request.nextUrl.origin}/api/billing/leads/${invoice.lead_id}/ensure-tax-invoice`;
          const ensureRes = await fetch(ensureUrl, {
            method: 'POST',
            headers: {
              ...(cookie ? { cookie } : {}),
              ...(authorization ? { authorization } : {}),
            },
            cache: 'no-store',
          });
          const ensured = await ensureRes.json().catch(() => ({}));
          if (ensureRes.ok && ensured?.tax_invoice?.id) {
            taxInvoice = ensured.tax_invoice;
          } else {
            console.warn('Non-blocking: ensure-tax-invoice failed after payment:', {
              status: ensureRes.status,
              error: ensured?.error,
              details: ensured?.details,
              code: ensured?.code,
              hint: ensured?.hint,
            });
          }
        } catch (e) {
          console.warn('Non-blocking: ensure-tax-invoice call errored after payment:', e);
        }
      }

      // Log status change
      await supabaseAdmin
        .from('lead_status_history')
        .insert({
          lead_id: invoice.lead_id,
          old_status: invoice.lead?.status || 'AWAITING_PAYMENT',
          new_status: newLeadStatus,
          changed_by: userProfile.id,
          changed_at: now,
          reason: `Payment received: ${payment_mode}`,
          notes: `Amount: ₹${paidAmount.toFixed(2)}. ${payment_remarks || ''}`,
        });

      // Create activity log
      await supabaseAdmin
        .from('lead_activities')
        .insert({
          lead_id: invoice.lead_id,
          user_id: userProfile.id,
          activity_type: 'PAYMENT_RECEIVED',
          description: `Payment of ₹${paidAmount.toFixed(2)} received via ${payment_mode}`,
          old_status: invoice.lead?.status || 'AWAITING_PAYMENT',
          new_status: newLeadStatus,
          metadata: {
            invoice_id: invoiceId,
            invoice_number: invoice.invoice_number,
            payment_mode: payment_mode,
            paid_amount: paidAmount,
            transaction_id: transactionId,
            payment_received_by: userProfile.id,
            payment_remarks: payment_remarks,
          },
        });

      // In-app notifications (no WhatsApp dependency)
      try {
        const leadAny = invoice.lead as any;
        const leadNumber = leadAny?.lead_number || invoice.lead_id;

        if (leadAny?.workshop_id) {
          await notifyWorkshopRoles({
            workshopId: leadAny.workshop_id,
            roleCodes: ['WORKSHOP_ADMIN'],
            type: 'PAYMENT_RECEIVED',
            title: 'Payment updated',
            message: isFullPayment
              ? `Full payment received for lead ${leadNumber}.`
              : `Payment recorded for lead ${leadNumber}. Balance pending.`,
            priority: isFullPayment ? 'MEDIUM' : 'LOW',
            leadId: invoice.lead_id,
            leadNumber,
            actionUrl: `/dashboard/workshop_admin/leads/pending`,
            metadata: { invoice_id: invoiceId, payment_mode, paid_amount: paidAmount, is_cod },
          });
        }

        if (leadAny?.assigned_supervisor_id) {
          await createNotification({
            userId: leadAny.assigned_supervisor_id,
            type: 'PAYMENT_RECEIVED',
            title: 'Payment Updated',
            message: isFullPayment
              ? `Full payment received for lead ${leadNumber}. Vehicle is ready for delivery.`
              : `Payment recorded for lead ${leadNumber}. Balance pending.`,
            priority: isFullPayment ? 'HIGH' : 'MEDIUM',
            leadId: invoice.lead_id,
            leadNumber,
            actionUrl: `/dashboard/workshop_supervisor/jobs/${invoice.lead_id}`,
            metadata: { invoice_id: invoiceId, payment_mode, paid_amount: paidAmount, is_cod },
          });
        }

        // Telecaller + Teamlead: notify only on full payment to avoid spam
        if (isFullPayment && leadAny?.assigned_telecaller_id) {
          const telecallerId = String(leadAny.assigned_telecaller_id);
          await createNotification({
            userId: telecallerId,
            type: 'PAYMENT_RECEIVED',
            title: 'Payment received',
            message: `Lead ${leadNumber} is fully paid.`,
            priority: 'LOW',
            leadId: invoice.lead_id,
            leadNumber,
            actionUrl: `/dashboard/telecaller/leads/${invoice.lead_id}`,
            metadata: { invoice_id: invoiceId, payment_mode, paid_amount: paidAmount, is_cod },
          });

          await notifyTelecallerTeamlead({
            telecallerId,
            leadId: invoice.lead_id,
            leadNumber,
            type: 'PAYMENT_RECEIVED',
            title: 'Payment received',
            message: `Lead ${leadNumber} is fully paid.`,
            priority: 'LOW',
            metadata: { invoice_id: invoiceId, payment_mode, paid_amount: paidAmount, is_cod },
          });
        }

        if (newLeadStatus === 'READY_FOR_DELIVERY') {
          await notifyCSETeam(
            invoice.lead_id,
            leadNumber,
            'Payment Received',
            `Lead ${leadNumber} is fully paid.`,
            'MEDIUM'
          );
        }
      } catch (e) {
        console.warn('Notification dispatch failed (non-blocking):', e);
      }

      // Create lead event for payment (Step 13: Notifications & Audit Trail)
      await supabaseAdmin
        .from('lead_events')
        .insert({
          lead_id: invoice.lead_id,
          event_type: is_cod ? 'PAYMENT_COD_RECORDED' : (isFullPayment ? 'PAYMENT_RECEIVED' : 'PAYMENT_PARTIAL'),
          event_description: `Payment of ₹${paidAmount.toFixed(2)} received via ${payment_mode}${is_cod ? ' (COD)' : ''}`,
          event_data: {
            invoice_id: invoiceId,
            invoice_number: invoice.invoice_number,
            payment_mode: payment_mode,
            paid_amount: paidAmount,
            transaction_id: transactionId,
            is_cod: is_cod,
            is_partial: !isFullPayment,
            payment_received_by: userProfile.id,
            payment_remarks: payment_remarks,
            timestamp: now,
          },
          created_by: userProfile.id,
          created_at: now,
        });

      // Auto-generate receipt for full payments (Step 5: Receipt Generation)
      if (isFullPayment && !is_cod) {
        try {
          // Call receipt generation API
          const receiptResponse = await fetch(
            `${request.nextUrl.origin}/api/payments/invoices/${invoiceId}/generate-receipt`,
            { method: 'POST' }
          );
          
          if (receiptResponse.ok) {
            const receiptData = await receiptResponse.json();
            console.log('Receipt auto-generated:', receiptData.receipt_url);
          }
        } catch (receiptError) {
          // Log error but don't fail payment recording
          console.error('Error auto-generating receipt:', receiptError);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: is_cod 
        ? 'COD payment recorded. Awaiting collection.' 
        : isFullPayment 
        ? 'Payment recorded successfully' 
        : 'Partial payment recorded',
      payment: paymentTransaction,
      invoice: updatedInvoice,
      tax_invoice: taxInvoice,
      balance_due: newBalanceDue,
      is_full_payment: isFullPayment,
      is_cod: is_cod,
      next_step: is_cod
        ? 'COD payment recorded. Schedule collection.'
        : isFullPayment 
        ? 'Vehicle ready for delivery' 
        : `Awaiting remaining payment of ₹${newBalanceDue.toFixed(2)}`,
    }, { status: 200 });

  } catch (error) {
    console.error('Error in record payment API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: (error as any)?.message },
      { status: 500 }
    );
  }
}

