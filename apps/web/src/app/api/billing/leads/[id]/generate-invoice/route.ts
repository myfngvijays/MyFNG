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

    // Get customer address details (used for both tax calculation and invoice display)
    const customerAddress = lead.customer?.address || lead.customer_address || '';
    const customerCity = lead.customer?.city || lead.customer_city || '';
    const customerState = lead.customer?.state || lead.customer_state || 'Maharashtra';
    const customerStateCode = lead.customer?.state_code || lead.customer_state_code || '27';
    const customerPincode = lead.customer?.pincode || lead.customer_pincode || '';

    // Determine place of supply and tax type
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

    const now = new Date();
    const nowISO = now.toISOString();
    const invoiceDate = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const invoiceTime = now.toTimeString().split(' ')[0].substring(0, 8); // HH:MM:SS
    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + 7); // 7 days from invoice date

    // Get workshop bank details (if available)
    const bankName = lead.workshop?.bank_name || 'HDFC Bank';
    const bankAccountName = lead.workshop?.bank_account_name || lead.workshop?.name || 'MyFNG Autocare Pvt. Ltd.';
    const bankAccountNumber = lead.workshop?.bank_account_number || '123456789012';
    const bankIFSC = lead.workshop?.bank_ifsc || 'HDFC0001234';
    const bankBranch = lead.workshop?.bank_branch || `${lead.workshop?.city || 'Kamothe'}, Navi Mumbai`;

    // Get warranty info from job card
    const warrantyInfo = {
      labour_warranty: jobCard?.warranty_labour_period || '1 month / 1,000 km (whichever earlier)',
      parts_warranty: jobCard?.warranty_parts_period || '6 months',
      notes: jobCard?.warranty_notes || 'Warranty on service: 1 month / 1,000 km (whichever earlier) on labour for this job.'
    };

    // Create invoice with all required fields
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        lead_id: leadId,
        workshop_id: lead.workshop_id,
        customer_id: lead.customer_id || lead.customer?.id,
        jobcard_id: jobCard?.id || null,
        invoice_number: invoiceNumber,
        
        // Invoice Date & Time
        invoice_date: invoiceDate,
        invoice_time: invoiceTime,
        due_date: dueDate.toISOString().split('T')[0],
        payment_terms: 'Due on Receipt',
        
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
        
        // Round off
        round_off_amount: roundOffAmount,
        
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
        
        // Customer Address (for invoice display)
        customer_address: customerAddress,
        customer_city: customerCity,
        customer_state: customerState,
        customer_pincode: customerPincode,
        
        // Bank Details
        bank_name: bankName,
        bank_account_name: bankAccountName,
        bank_account_number: bankAccountNumber,
        bank_ifsc: bankIFSC,
        bank_branch: bankBranch,
        
        // Warranty Info
        warranty_info: warrantyInfo,
        
        // Old Parts (default false, can be updated later)
        old_parts_handed_over: false,
        
        // Status
        status: 'GENERATED',
        payment_status: 'PENDING',
        
        // Audit
        generated_by: userProfile.id,
        created_at: nowISO,
        updated_at: nowISO,
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

    // Update lead with invoice details (Step 0: System actions)
    // Status should be INVOICE_GENERATED initially, will change to AWAITING_PAYMENT after approval
    await supabase
      .from('service_leads')
      .update({
        invoice_id: invoice.id,
        invoice_amount: finalAmount,
        invoice_generated_by: userProfile.id,
        invoice_generated_at: nowISO,
        status: 'INVOICE_GENERATED', // Will change to AWAITING_PAYMENT after approval
        updated_at: nowISO
      })
      .eq('id', leadId);

    // Lock job card for edits after invoice generation (Step 0: System actions)
    // Mark job card as locked after invoice generation
    if (jobCard) {
      // Update job card with locked_at timestamp (column added in migration 78)
      await supabase
        .from('job_cards')
        .update({
          locked_at: nowISO,
          locked_by: userProfile.id,
          lock_reason: `Locked after invoice generation: ${invoiceNumber}`,
          status: 'INVOICE_GENERATED', // Mark as invoice generated to prevent edits
          updated_at: nowISO,
        })
        .eq('id', jobCard.id);

      // Log job card lock event
      await supabase
        .from('lead_activities')
        .insert({
          lead_id: leadId,
          user_id: userProfile.id,
          activity_type: 'JOB_CARD_LOCKED',
          description: `Job card locked after invoice generation`,
          metadata: {
            jobcard_id: jobCard.id,
            invoice_id: invoice.id,
            invoice_number: invoiceNumber,
            locked_at: nowISO,
            locked_by: userProfile.id,
          },
        });
    }

    // Log status change
    await supabase
      .from('lead_status_history')
      .insert({
        lead_id: leadId,
        old_status: lead.status,
        new_status: 'INVOICE_GENERATED',
        changed_by: userProfile.id,
        changed_at: nowISO,
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
          round_off: roundOffAmount,
          due_date: dueDate.toISOString().split('T')[0],
          generated_by: userProfile.id,
          generated_at: nowISO
        }
      });

    // Create finance event for invoice creation (Step 0: System actions)
    await createFinanceEvent({
      eventType: 'invoice_created',
      entityType: 'invoice',
      entityId: invoice.id,
      actorId: userProfile.id,
      actorRole: roleCode,
      eventData: {
        invoice_number: invoiceNumber,
        lead_id: leadId,
        jobcard_id: jobCard?.id,
        final_amount: finalAmount,
        base_amount: baseAmount,
        extra_charges: extraChargesTotal,
        parts_cost: partsTotal,
        total_tax: totalTax,
        round_off: roundOffAmount,
        due_date: dueDate.toISOString().split('T')[0],
        generated_at: nowISO,
      },
    });

    // Create lead event for invoice creation (Step 13: Notifications & Audit Trail)
    await supabase
      .from('lead_events')
      .insert({
        lead_id: leadId,
        event_type: 'INVOICE_GENERATED',
        event_description: `Invoice ${invoiceNumber} generated - Amount: ₹${finalAmount.toFixed(2)}`,
        event_data: {
          invoice_id: invoice.id,
          invoice_number: invoiceNumber,
          final_amount: finalAmount,
          base_amount: baseAmount,
          extra_charges: extraChargesTotal,
          parts_cost: partsTotal,
          total_tax: totalTax,
          generated_by: userProfile.id,
          generated_at: nowISO,
        },
        created_by: userProfile.id,
        created_at: nowISO,
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
        due_date: dueDate.toISOString().split('T')[0],
        payment_terms: 'Due on Receipt',
      },
      line_items: lineItems,
      warranty_info: warrantyInfo,
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

