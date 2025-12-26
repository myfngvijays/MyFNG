import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { calculateTaxes, generateSeriesDocumentNumber, getPlaceOfSupply, numberToWords, roundOff } from '@/lib/utils/invoiceUtils';

export const dynamic = 'force-dynamic';

/**
 * POST /api/billing/leads/[id]/finalize-bill
 *
 * Billing/System finalizes billable items + applies rule-based GST.
 * Output is used for Customer Invoice (no GST visible) and Tax Invoice generation post-payment.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // users_login is mapped by email/phone; not always auth user.id
    const email = (user.email || '').trim();
    const phone = (user.phone || '').trim();
    const selectProfile = 'id, email, phone, role_id, workshop_id, roles!inner(role_code)';

    const { data: userProfileByEmail } = email
      ? await supabase.from('users_login').select(selectProfile).ilike('email', email).maybeSingle()
      : { data: null };
    const { data: userProfileByPhone } = !userProfileByEmail && phone
      ? await supabase.from('users_login').select(selectProfile).eq('phone', phone).maybeSingle()
      : { data: null };

    const userProfile = userProfileByEmail || userProfileByPhone;
    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const roleCode = (userProfile.roles as any)?.role_code;
    const allowedRoles = ['SUPER_ADMIN', 'SUB_ADMIN', 'WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR', 'BILLING'];
    if (!allowedRoles.includes(roleCode)) {
      return NextResponse.json({ error: 'Forbidden: Billing access required', role: roleCode }, { status: 403 });
    }

    const leadId = params.id;

    // Best-effort payload: allow billing adjustments / checklist notes later.
    let payload: any = {};
    try {
      payload = await request.json();
    } catch {
      payload = {};
    }

    // Fetch lead
    const { data: lead, error: leadError } = await supabase
      .from('service_leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    if (lead.read_only) {
      return NextResponse.json({ error: 'Lead is archived/read-only' }, { status: 400 });
    }

    // Workshop scoping for workshop staff
    if (['WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR'].includes(roleCode)) {
      if (!userProfile.workshop_id || userProfile.workshop_id !== lead.workshop_id) {
        return NextResponse.json({ error: 'Forbidden: Lead not in your workshop' }, { status: 403 });
      }
    }

    // Ensure lead has series suffix
    let seriesYear = (lead as any).invoice_series_year as number | null;
    let seriesMonth = (lead as any).invoice_series_month as number | null;
    let seriesSeq = (lead as any).invoice_series_seq as number | null;

    if (!seriesYear || !seriesMonth || !seriesSeq) {
      const d = new Date();
      seriesYear = d.getFullYear();
      seriesMonth = d.getMonth() + 1;

      const { data: seqData, error: seqError } = await supabase.rpc('next_invoice_series_seq', {
        p_year: seriesYear,
        p_month: seriesMonth,
      });

      if (seqError) {
        return NextResponse.json(
          { error: 'Failed to allocate invoice series sequence', details: seqError.message },
          { status: 500 }
        );
      }

      seriesSeq = typeof seqData === 'number' ? seqData : parseInt(String(seqData || '0'), 10);

      await supabase
        .from('service_leads')
        .update({
          invoice_series_year: seriesYear,
          invoice_series_month: seriesMonth,
          invoice_series_seq: seriesSeq,
          updated_at: new Date().toISOString(),
        })
        .eq('id', leadId);
    }

    // Fetch workshop (for GST state)
    const { data: workshop } = await supabase
      .from('workshops')
      .select('id, state, state_code, gst_number')
      .eq('id', lead.workshop_id)
      .maybeSingle();

    const customerState = (lead as any).customer_state || lead.state || '';
    const customerStateCode = (lead as any).customer_state_code || (lead as any).state_code || '';
    const workshopState = workshop?.state || '';
    const workshopStateCode = workshop?.state_code || '';
    const place = getPlaceOfSupply(customerState, customerStateCode, workshopState, workshopStateCode);

    // Build billable items snapshot
    const [{ data: pricingItems }, { data: extraCharges }, { data: jobCard }] = await Promise.all([
      supabase
        .from('lead_pricing_items')
        .select('name, final_price, quantity, category, item_type')
        .eq('lead_id', leadId)
        .eq('status', 'ACTIVE'),
      supabase
        .from('lead_extra_charges')
        .select('description, amount, charge_type, category')
        .eq('lead_id', leadId)
        .eq('status', 'APPROVED'),
      supabase
        .from('job_cards')
        .select('id, jobcard_number, job_card_parts(part_name, part_number, quantity, unit_price, total_price)')
        .eq('lead_id', leadId)
        .maybeSingle(),
    ]);

    const serviceLines = (pricingItems || []).map((it: any) => {
      const qty = it.quantity ? parseFloat(String(it.quantity)) : 1;
      const amount = parseFloat(it.final_price || '0') || 0;
      return {
        description: it.name || 'Service',
        qty,
        rate: qty ? amount / qty : amount,
        amount,
        category: it.category || it.item_type || 'SERVICE',
      };
    });

    const partLines = (jobCard?.job_card_parts || []).map((p: any) => ({
      description: `${p.part_name || 'Part'}${p.part_number ? ` (${p.part_number})` : ''}`,
      qty: p.quantity || 1,
      rate: p.unit_price || 0,
      amount: p.total_price || 0,
      category: 'PART',
    }));

    const extraLines = (extraCharges || []).map((c: any) => ({
      description: c.description || 'Extra Charge',
      qty: 1,
      rate: parseFloat(c.amount || '0') || 0,
      amount: parseFloat(c.amount || '0') || 0,
      category: c.charge_type || c.category || 'EXTRA',
    }));

    const baseAmount = serviceLines.reduce((sum: number, l: any) => sum + (l.amount || 0), 0);
    const partsCost = partLines.reduce((sum: number, l: any) => sum + (l.amount || 0), 0);
    const extraChargesAmount = extraLines.reduce((sum: number, l: any) => sum + (l.amount || 0), 0);
    const subTotal = Math.max(0, baseAmount + partsCost + extraChargesAmount);

    const discountAmount =
      payload?.discount_amount !== undefined && payload?.discount_amount !== null
        ? Number(payload.discount_amount) || 0
        : parseFloat((lead as any).discount_amount || '0') || 0;

    const netTaxable = Math.max(0, subTotal - discountAmount);
    const taxes = calculateTaxes(netTaxable, place.useIGST);
    const preRoundTotal = netTaxable + taxes.totalTax;
    const roundedTotal = roundOff(preRoundTotal);
    const roundOffAmount = parseFloat((roundedTotal - preRoundTotal).toFixed(2));

    const finalAmount = roundedTotal;
    const amountInWords = numberToWords(finalAmount);

    const ciNumber = generateSeriesDocumentNumber('CI', seriesYear!, seriesMonth!, seriesSeq!);
    const now = new Date().toISOString();

    // Upsert CUSTOMER_INVOICE record (internal finalized; not public until customer confirms)
    const { data: existingCI } = await supabase
      .from('invoices')
      .select('id, payment_status')
      .eq('lead_id', leadId)
      .eq('invoice_type', 'CUSTOMER_INVOICE')
      .maybeSingle();

    if (existingCI?.payment_status === 'PAID') {
      return NextResponse.json(
        { error: 'Customer invoice already paid; cannot re-finalize', invoice_id: existingCI.id },
        { status: 400 }
      );
    }

    const invoicePayload: any = {
      invoice_number: ciNumber,
      lead_id: leadId,
      workshop_id: lead.workshop_id,
      base_amount: baseAmount,
      parts_cost: partsCost,
      extra_charges: extraChargesAmount,
      labour_cost: 0,
      sub_total: subTotal,
      discount_amount: discountAmount,
      cgst_percentage: place.useIGST ? 0 : 9,
      cgst_amount: taxes.cgstAmount,
      sgst_percentage: place.useIGST ? 0 : 9,
      sgst_amount: taxes.sgstAmount,
      igst_percentage: place.useIGST ? 18 : 0,
      igst_amount: taxes.igstAmount,
      total_tax: taxes.totalTax,
      round_off_amount: roundOffAmount,
      final_amount: finalAmount,
      amount_in_words: amountInWords,
      place_of_supply: place.placeOfSupply,
      place_of_supply_state_code: place.stateCode,
      status: 'APPROVED', // billing finalized
      payment_status: 'PENDING',
      generated_by: userProfile.id,
      invoice_type: 'CUSTOMER_INVOICE',
      series_year: seriesYear,
      series_month: seriesMonth,
      series_seq: seriesSeq,
      visible_to_customer: false, // becomes true after customer confirms
      show_gst_breakup: false, // never show GST on customer invoice
      line_items: [...serviceLines, ...partLines, ...extraLines],
    };

    let ciInvoice: any = null;
    if (existingCI?.id) {
      const { data: updated, error: updErr } = await supabase
        .from('invoices')
        .update({ ...invoicePayload, updated_at: now })
        .eq('id', existingCI.id)
        .select('*')
        .single();

      if (updErr) {
        return NextResponse.json({ error: 'Failed to update customer invoice', details: updErr.message }, { status: 500 });
      }
      ciInvoice = updated;
    } else {
      const { data: created, error: insErr } = await supabase
        .from('invoices')
        .insert({ ...invoicePayload, created_at: now, updated_at: now })
        .select('*')
        .single();

      if (insErr) {
        return NextResponse.json({ error: 'Failed to create customer invoice', details: insErr.message }, { status: 500 });
      }
      ciInvoice = created;
    }

    // Keep lead in PAYMENT_AWAITING (awaiting payment/confirmation) and lock edits.
    await supabase
      .from('service_leads')
      .update({
        status: lead.status === 'PAYMENT_AWAITING' ? lead.status : 'PAYMENT_AWAITING',
        billing_locked_at: (lead as any).billing_locked_at || now,
        invoice_id: ciInvoice.id, // payable doc is CI
        invoice_number: ciInvoice.invoice_number,
        invoice_generated_at: now,
        invoice_generated_by: userProfile.id,
        updated_at: now,
      })
      .eq('id', leadId);

    return NextResponse.json({
      success: true,
      message: 'Bill finalized successfully',
      lead_id: leadId,
      invoice: ciInvoice,
      snapshot: {
        place_of_supply: place,
        totals: {
          base_amount: baseAmount,
          parts_cost: partsCost,
          extra_charges: extraChargesAmount,
          sub_total: subTotal,
          discount_amount: discountAmount,
          taxes,
          round_off_amount: roundOffAmount,
          final_amount: finalAmount,
        },
      },
    });
  } catch (error: any) {
    console.error('Finalize bill error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error?.message }, { status: 500 });
  }
}


