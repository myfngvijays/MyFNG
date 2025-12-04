import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import {
  generateInvoiceNumber,
  getHSNCode,
  getPlaceOfSupply,
  calculateTaxes,
  numberToWords,
  roundOff,
} from '@/lib/utils/invoiceUtils';
import { createFinanceEvent } from '@/lib/services/financeEventService';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile with role join
    const { data: userProfile, error: profileError } = await supabase
      .from('users_login')
      .select('id, role_id, workshop_id, roles(role_code, role_name)')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Get role code
    const roleCode = (userProfile.roles as any)?.role_code;

    // Verify user has billing permissions - allow advisor and admin
    const allowedRoles = ['SUPER_ADMIN', 'SUB_ADMIN', 'WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR'];
    if (!allowedRoles.includes(roleCode)) {
      return NextResponse.json({ 
        error: 'Forbidden: Insufficient permissions',
        current_role: roleCode
      }, { status: 403 });
    }

    const leadId = params.id;

    // Get lead details with customer and workshop info
    const { data: lead, error: leadError } = await supabase
      .from('service_leads')
      .select(`
        *,
        workshop:workshops!workshop_id(
          id,
          name,
          address,
          city,
          state,
          state_code,
          phone,
          email,
          gst_number
        ),
        customer:users_login!customer_id(
          id,
          name,
          email,
          phone,
          address,
          city,
          state,
          state_code
        )
      `)
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Verify lead is ready for billing - allow READY_FOR_DELIVERY for advisor
    const validStatuses = ['QC_APPROVED', 'READY_FOR_BILLING', 'AUDIT_APPROVED', 'READY_FOR_DELIVERY', 'DELIVERED', 'CLOSED'];
    if (!validStatuses.includes(lead.status)) {
      return NextResponse.json({ 
        error: 'Lead not ready for billing',
        current_status: lead.status,
        hint: 'Lead must be QC approved, audit approved, or ready for delivery'
      }, { status: 400 });
    }

    // Verify user belongs to the same workshop (for workshop staff)
    if (['WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR'].includes(roleCode)) {
      if (!userProfile.workshop_id || userProfile.workshop_id !== lead.workshop_id) {
        return NextResponse.json({ error: 'Forbidden: Lead not in your workshop' }, { status: 403 });
      }
    }

    // Check if invoice already exists
    const { data: existingInvoice } = await supabase
      .from('invoices')
      .select('*')
      .eq('lead_id', leadId)
      .single();

    if (existingInvoice) {
      return NextResponse.json({ 
        error: 'Invoice already exists for this lead',
        invoice: existingInvoice
      }, { status: 400 });
    }

    // Fetch pricing items from lead_pricing_items table
    const { data: pricingItems } = await supabase
      .from('lead_pricing_items')
      .select('*')
      .eq('lead_id', leadId)
      .eq('status', 'ACTIVE');

    // Get all approved extra charges
    const { data: extraCharges } = await supabase
      .from('lead_extra_charges')
      .select('*')
      .eq('lead_id', leadId)
      .eq('status', 'APPROVED');

    // Get job card parts
    const { data: jobCard } = await supabase
      .from('job_cards')
      .select(`
        *,
        job_card_parts(*)
      `)
      .eq('lead_id', leadId)
      .single();

    // Calculate base amount from pricing items
    const baseAmount = pricingItems?.reduce((sum, item) => sum + parseFloat(item.final_price || '0'), 0) || 
                       parseFloat(lead.estimated_amount || '0');
    
    const extraChargesTotal = extraCharges?.reduce((sum, charge) => sum + parseFloat(charge.amount || '0'), 0) || 0;
    const partsTotal = jobCard?.job_card_parts?.reduce((sum: number, part: any) => 
      sum + parseFloat(part.total_price || '0'), 0) || 0;
    
    const discount = parseFloat(lead.discount_amount || '0');
    const couponCode = lead.coupon_code || null;

    // Calculate subtotal
    const subtotal = baseAmount + extraChargesTotal + partsTotal - discount;

    // Determine place of supply and tax type
    const customerState = lead.customer?.state || lead.customer_state || 'Maharashtra';
    const customerStateCode = lead.customer?.state_code || lead.customer_state_code || '27';
    const workshopState = lead.workshop?.state || 'Maharashtra';
    const workshopStateCode = lead.workshop?.state_code || '27';

    const { placeOfSupply, stateCode, useIGST } = getPlaceOfSupply(
      customerState,
      customerStateCode,
      workshopState,
      workshopStateCode
    );

    // Calculate taxes (CGST 9% + SGST 9% or IGST 18%)
    const { cgstAmount, sgstAmount, igstAmount, totalTax } = calculateTaxes(
      subtotal,
      useIGST,
      9, // CGST 9%
      9, // SGST 9%
      18 // IGST 18%
    );

    // Calculate final amount
    const finalAmountBeforeRound = subtotal + totalTax;
    const finalAmount = roundOff(finalAmountBeforeRound);
    const roundOffAmount = finalAmount - finalAmountBeforeRound;

    // Generate invoice number
    const invoiceNumber = generateInvoiceNumber();

    // Create line items with HSN/SAC codes
    const lineItems: any[] = [];
    const hsnSacCodes: string[] = [];

    // Add pricing items
    pricingItems?.forEach((item) => {
      const hsnCode = getHSNCode(item.item_name, true);
      lineItems.push({
        description: item.item_name,
        hsn_sac: hsnCode,
        qty: item.qty || 1,
        rate: parseFloat(item.final_price || '0') / (item.qty || 1),
        amount: parseFloat(item.final_price || '0'),
        is_addon: item.is_addon || false,
      });
      if (!hsnSacCodes.includes(hsnCode)) {
        hsnSacCodes.push(hsnCode);
      }
    });

    // Add parts
    jobCard?.job_card_parts?.forEach((part: any) => {
      const hsnCode = getHSNCode(part.part_name, false);
      lineItems.push({
        description: part.part_name,
        hsn_sac: hsnCode,
        qty: part.quantity || 1,
        rate: parseFloat(part.unit_price || '0'),
        amount: parseFloat(part.total_price || '0'),
        is_part: true,
      });
      if (!hsnSacCodes.includes(hsnCode)) {
        hsnSacCodes.push(hsnCode);
      }
    });

    // Add extra charges
    extraCharges?.forEach((charge) => {
      lineItems.push({
        description: charge.description || 'Extra Work',
        hsn_sac: '998729', // Service code
        qty: 1,
        rate: parseFloat(charge.amount || '0'),
        amount: parseFloat(charge.amount || '0'),
        is_extra: true,
      });
    });

    // Amount in words
    const amountInWords = numberToWords(finalAmount);

    const now = new Date().toISOString();

    // Create invoice with all required fields
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        lead_id: leadId,
        workshop_id: lead.workshop_id,
        customer_id: lead.customer_id || lead.customer?.id,
        invoice_number: invoiceNumber,
        
        // Amounts
        base_amount: baseAmount,
        extra_charges: extraChargesTotal,
        parts_cost: partsTotal,
        labour_cost: baseAmount, // Base service is labour
        sub_total: subtotal,
        
        // Discounts
        coupon_code: couponCode,
        discount_percentage: discount > 0 ? (discount / subtotal) * 100 : 0,
        discount_amount: discount,
        
        // Taxes
        cgst_percentage: useIGST ? 0 : 9,
        cgst_amount: cgstAmount,
        sgst_percentage: useIGST ? 0 : 9,
        sgst_amount: sgstAmount,
        igst_percentage: useIGST ? 18 : 0,
        igst_amount: igstAmount,
        total_tax: totalTax,
        
        // Final
        final_amount: finalAmount,
        amount_in_words: amountInWords,
        
        // Place of Supply
        place_of_supply: placeOfSupply,
        place_of_supply_state_code: stateCode,
        
        // Line Items & HSN/SAC
        line_items: lineItems,
        hsn_sac_codes: hsnSacCodes,
        
        // Status
        status: 'GENERATED',
        payment_status: 'PENDING',
        
        // Audit
        generated_by: userProfile.id,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (invoiceError) {
      console.error('Error creating invoice:', invoiceError);
      console.error('Invoice error details:', JSON.stringify(invoiceError, null, 2));
      return NextResponse.json({ 
        error: 'Failed to generate invoice',
        details: invoiceError.message 
      }, { status: 500 });
    }

    // Update lead with invoice details
    await supabase
      .from('service_leads')
      .update({
        invoice_id: invoice.id,
        invoice_amount: finalAmount,
        invoice_generated_by: userProfile.id,
        invoice_generated_at: now,
        status: 'INVOICE_GENERATED',
        updated_at: now
      })
      .eq('id', leadId);

    // Lock job card for edits (except allowed fields)
    // Mark job card as locked after invoice generation
    const { data: existingJobCard } = await supabase
      .from('job_cards')
      .select('id')
      .eq('lead_id', leadId)
      .single();

    if (jobCard) {
      // Add locked_at timestamp to job card (if column exists)
      // For now, we'll track this via a metadata field or status
      await supabase
        .from('job_cards')
        .update({
          updated_at: now,
          // Note: If job_cards table has a locked_at or is_locked column, update it here
        })
        .eq('id', jobCard.id);
    }

    // Log status change
    await supabase
      .from('lead_status_history')
      .insert({
        lead_id: leadId,
        old_status: lead.status,
        new_status: 'INVOICE_GENERATED',
        changed_by: userProfile.id,
        changed_at: now,
        reason: 'Invoice generated',
        notes: `Invoice number: ${invoiceNumber}`
      });

    // Create activity log
    await supabase
      .from('lead_activities')
      .insert({
        lead_id: leadId,
        user_id: userProfile.id,
        activity_type: 'INVOICE_GENERATED',
        description: `Invoice generated: ${invoiceNumber}`,
        old_status: lead.status,
        new_status: 'INVOICE_GENERATED',
        metadata: {
          invoice_id: invoice.id,
          invoice_number: invoiceNumber,
          base_amount: baseAmount,
          extra_charges: extraChargesTotal,
          discount: discount,
          tax_amount: totalTax,
          final_amount: finalAmount,
          generated_by: userProfile.id,
          generated_at: now
        }
      });

    // Create finance event for invoice creation
    await createFinanceEvent({
      eventType: 'invoice_created',
      entityType: 'invoice',
      entityId: invoice.id,
      actorId: userProfile.id,
      actorRole: roleCode,
      eventData: {
        invoice_number: invoiceNumber,
        lead_id: leadId,
        final_amount: finalAmount,
        base_amount: baseAmount,
        extra_charges: extraChargesTotal,
        parts_cost: partsTotal,
        total_tax: totalTax,
        generated_at: now,
      },
    });

    // TODO: Generate PDF invoice
    // TODO: Send invoice to customer (Email/WhatsApp)
    // TODO: Send notification to workshop admin

    return NextResponse.json({
      success: true,
      message: 'Invoice generated successfully',
      invoice: invoice,
      breakdown: {
        base_amount: baseAmount,
        parts_cost: partsTotal,
        extra_charges: extraChargesTotal,
        discount: discount,
        subtotal: subtotal,
        cgst_amount: cgstAmount,
        sgst_amount: sgstAmount,
        igst_amount: igstAmount,
        total_tax: totalTax,
        final_amount: finalAmount,
        round_off: roundOffAmount,
        amount_in_words: amountInWords,
        place_of_supply: placeOfSupply,
        use_igst: useIGST,
      },
      line_items: lineItems,
      next_step: 'Review invoice and send to customer for payment'
    }, { status: 201 });

  } catch (error) {
    console.error('Error in generate invoice API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

