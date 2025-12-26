/**
 * Invoice Generation API
 * Task: WA-702
 * Generates invoice for completed leads
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const leadId = params.id;

  try {
    // Fetch lead details with all related data including pricing fields
    const { data: lead, error: leadError } = await supabase
      .from('service_leads')
      .select(`
        *,
        workshop:workshops!workshop_id(name, address, phone, email, gst_number)
      `)
      .eq('id', leadId)
      .single();
    
    // Debug: Log lead pricing fields
    console.log('Lead pricing fields:', {
      estimated_cost: lead?.estimated_cost,
      estimated_amount: lead?.estimated_amount,
      final_amount: lead?.final_amount,
      total_price: lead?.total_price,
      actual_amount: lead?.actual_amount,
      discount_amount: lead?.discount_amount,
      tax_amount: lead?.tax_amount,
    });

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Check authorization - fetch role with join
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

    // Verify user has invoice generation permissions
    const allowedRoles = ['SUPER_ADMIN', 'SUB_ADMIN', 'WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR'];
    if (!allowedRoles.includes(roleCode)) {
      return NextResponse.json({ 
        error: 'Forbidden: Insufficient permissions',
        current_role: roleCode
      }, { status: 403 });
    }

    // Verify user belongs to the same workshop (for workshop staff)
    if (['WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR'].includes(roleCode)) {
      if (!userProfile.workshop_id || userProfile.workshop_id !== lead.workshop_id) {
        return NextResponse.json({ error: 'Forbidden: Lead not in your workshop' }, { status: 403 });
      }
    }

    // Check if lead status allows invoice generation
    if (!['READY_FOR_DELIVERY', 'DELIVERED_TO_CUSTOMER', 'DELIVERED', 'CLOSED'].includes(lead.status)) {
      return NextResponse.json(
        { error: 'Invoice can only be generated for completed leads' },
        { status: 400 }
      );
    }

    // Check if any invoice already exists for this lead.
    // NEW FLOW: a lead can have multiple invoices (ORDER_SUMMARY, CUSTOMER_INVOICE, TAX_INVOICE).
    const { data: existingInvoices } = await supabase
      .from('invoices')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false });

    if (existingInvoices && existingInvoices.length > 0) {
      const preferred =
        existingInvoices.find((i: any) => i.invoice_type === 'TAX_INVOICE') ||
        existingInvoices.find((i: any) => i.invoice_type === 'CUSTOMER_INVOICE') ||
        existingInvoices.find((i: any) => i.invoice_type === 'ORDER_SUMMARY') ||
        existingInvoices[0];

      return NextResponse.json(
        {
          success: true,
          invoice: preferred,
          invoices: existingInvoices,
          note: 'Existing invoice(s) found for this lead',
        },
        { status: 200 }
      );
    }

    // Fetch pricing items from lead_pricing_items table (primary source)
    const { data: pricingItems } = await supabase
      .from('lead_pricing_items')
      .select('*')
      .eq('lead_id', leadId)
      .eq('status', 'ACTIVE');

    // Fetch job card and parts
    const { data: jobCard } = await supabase
      .from('job_cards')
      .select('*, job_card_parts(*)')
      .eq('lead_id', leadId)
      .maybeSingle();

    // Fetch approved extra charges
    const { data: extraCharges } = await supabase
      .from('lead_extra_charges')
      .select('*')
      .eq('lead_id', leadId)
      .eq('status', 'APPROVED');

    // Calculate amounts - prioritize backend set rates:
    // 1. final_amount (if already calculated in backend)
    // 2. total_price (total with taxes)
    // 3. actual_amount (final before taxes)
    // 4. estimated_cost or estimated_amount (backend estimates)
    // 5. lead_pricing_items (if exists, sum them up)
    let baseAmount = 0;
    
    // Priority 1: Use final_amount if backend has already calculated it
    if (lead.final_amount && parseFloat(lead.final_amount) > 0) {
      baseAmount = parseFloat(lead.final_amount);
    }
    // Priority 2: Use total_price (includes taxes)
    else if (lead.total_price && parseFloat(lead.total_price) > 0) {
      baseAmount = parseFloat(lead.total_price);
    }
    // Priority 3: Use actual_amount (final before taxes)
    else if (lead.actual_amount && parseFloat(lead.actual_amount) > 0) {
      baseAmount = parseFloat(lead.actual_amount);
    }
    // Priority 4: Use estimated_cost (backend estimate)
    else if (lead.estimated_cost && parseFloat(lead.estimated_cost) > 0) {
      baseAmount = parseFloat(lead.estimated_cost);
    }
    // Priority 5: Use estimated_amount (backend estimate)
    else if (lead.estimated_amount && parseFloat(lead.estimated_amount) > 0) {
      baseAmount = parseFloat(lead.estimated_amount);
    }
    // Priority 6: Sum up pricing items if available
    else if (pricingItems && pricingItems.length > 0) {
      baseAmount = pricingItems.reduce(
        (sum, item) => sum + parseFloat(item.final_price || '0'),
        0
      );
    }
    
    const partsTotal = jobCard?.job_card_parts?.reduce(
      (sum: number, part: any) => sum + parseFloat(part.total_price || '0'),
      0
    ) || 0;
    
    const extraChargesTotal = extraCharges?.reduce(
      (sum, charge) => sum + parseFloat(charge.amount || '0'),
      0
    ) || 0;

    // Check if baseAmount already includes taxes (final_amount or total_price)
    const amountIncludesTax = lead.final_amount || lead.total_price;
    
    let subtotal, cgst, sgst, totalAmount;
    
    if (amountIncludesTax && baseAmount > 0) {
      // If backend already calculated final amount with taxes, use it directly
      // Extract tax from the total (assuming 18% total tax: 9% CGST + 9% SGST)
      const taxRate = 0.18; // 18% total
      subtotal = parseFloat((baseAmount / (1 + taxRate)).toFixed(2));
      cgst = parseFloat((subtotal * 0.09).toFixed(2));
      sgst = parseFloat((subtotal * 0.09).toFixed(2));
      totalAmount = baseAmount; // Use the backend calculated amount
    } else {
      // Calculate taxes from base amount
      subtotal = baseAmount + partsTotal + extraChargesTotal;
      cgst = parseFloat((subtotal * 0.09).toFixed(2)); // 9% CGST
      sgst = parseFloat((subtotal * 0.09).toFixed(2)); // 9% SGST
      totalAmount = parseFloat((subtotal + cgst + sgst).toFixed(2));
    }

    // If all amounts are 0, this might be an issue - log warning but allow to proceed
    if (baseAmount === 0 && partsTotal === 0 && extraChargesTotal === 0) {
      console.warn('⚠️ Warning: All invoice amounts are 0. Lead might not have pricing configured.');
      // You might want to return an error here or use a default amount
      // For now, we'll allow it but log the warning
    }

    // Debug logging
    console.log('Invoice calculation:', {
      pricingItemsCount: pricingItems?.length || 0,
      baseAmount,
      partsTotal,
      extraChargesTotal,
      subtotal,
      cgst,
      sgst,
      totalAmount,
      amountIncludesTax,
      leadFinalAmount: lead.final_amount,
      leadTotalPrice: lead.total_price,
      leadActualAmount: lead.actual_amount,
      leadEstimatedCost: lead.estimated_cost,
      leadEstimatedAmount: lead.estimated_amount,
    });

    // Generate invoice number - handle case where lead_number might be null
    // Make it more unique with timestamp and random component
    const leadNumber = lead.lead_number || lead.id.substring(0, 8).toUpperCase().replace(/-/g, '');
    const timestamp = Date.now();
    const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const invoiceNumber = `INV-${leadNumber}-${timestamp.toString().slice(-8)}-${randomSuffix}`;
    
    // Ensure invoice number doesn't exceed 50 characters (database constraint)
    const finalInvoiceNumber = invoiceNumber.length > 50 
      ? `INV-${timestamp}-${randomSuffix}` 
      : invoiceNumber;

    // Validate required fields
    if (!lead.workshop_id) {
      return NextResponse.json({ 
        error: 'Lead workshop_id is missing',
        lead_id: leadId
      }, { status: 400 });
    }

    // Create invoice with proper numeric types
    // All columns now available after migration
    const invoiceData: any = {
      lead_id: leadId,
      workshop_id: lead.workshop_id,
      invoice_number: finalInvoiceNumber,
      base_amount: baseAmount,
      parts_cost: partsTotal,
      extra_charges: extraChargesTotal,
      labour_cost: 0,
      discount: 0,
      sub_total: subtotal,
      // Tax columns
      cgst_percentage: 9,
      cgst_amount: cgst,
      sgst_percentage: 9,
      sgst_amount: sgst,
      igst_percentage: 0,
      igst_amount: 0,
      total_tax: cgst + sgst,
      tax_amount: cgst + sgst,
      final_amount: totalAmount,
      total_amount: totalAmount,
      payment_status: 'PENDING',
      status: 'GENERATED',
      invoice_type: 'TAX_INVOICE',
      visible_to_customer: false,
      show_gst_breakup: true,
      generated_by: userProfile.id,
    };

    console.log('Creating invoice with data:', JSON.stringify(invoiceData, null, 2));

    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert(invoiceData)
      .select()
      .single();

    if (invoiceError) {
      console.error('Error creating invoice:', invoiceError);
      console.error('Invoice error details:', JSON.stringify(invoiceError, null, 2));
      console.error('Invoice data attempted:', JSON.stringify(invoiceData, null, 2));
      return NextResponse.json({ 
        error: 'Failed to create invoice',
        details: invoiceError.message,
        code: invoiceError.code,
        hint: invoiceError.hint
      }, { status: 500 });
    }

    // Update lead with invoice details and status
    const now = new Date().toISOString();
    await supabase
      .from('service_leads')
      .update({ 
        final_amount: totalAmount,
        invoice_id: invoice.id,
        invoice_generated_by: userProfile.id,
        invoice_generated_at: now,
        status: 'INVOICE_GENERATED', // ✨ Update status to INVOICE_GENERATED
        updated_at: now
      })
      .eq('id', leadId);

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
        notes: `Invoice number: ${finalInvoiceNumber}`
      });

    // Create activity log
    await supabase
      .from('lead_activities')
      .insert({
        lead_id: leadId,
        user_id: userProfile.id,
        activity_type: 'INVOICE_GENERATED',
        description: `Invoice generated: ${finalInvoiceNumber}`,
        old_status: lead.status,
        new_status: 'INVOICE_GENERATED',
        metadata: {
          invoice_id: invoice.id,
          invoice_number: finalInvoiceNumber,
          total_amount: totalAmount,
        }
      });

    // Create event
    await supabase.from('lead_events').insert({
      lead_id: leadId,
      event_type: 'INVOICE_GENERATED',
      event_description: `Invoice ${finalInvoiceNumber} generated - ₹${totalAmount.toFixed(2)}`,
      event_data: {
        invoice_id: invoice.id,
        invoice_number: finalInvoiceNumber,
        total_amount: totalAmount,
      },
      created_by: user.id,
    });

    // Map database fields to component expected fields
    const mappedInvoice = {
      ...invoice,
      parts_amount: (invoice as any).parts_cost || 0,
      extra_charges_amount: invoice.extra_charges || 0,
      subtotal: (invoice as any).sub_total || ((invoice.base_amount || 0) + (invoice.extra_charges || 0) - (invoice.discount || 0)),
      cgst: (invoice as any).cgst_amount || 0,
      sgst: (invoice as any).sgst_amount || 0,
      total_amount: (invoice as any).final_amount || invoice.total_amount || 0,
      invoice_date: invoice.created_at || new Date().toISOString(),
      due_date: (invoice as any).due_date || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };

    return NextResponse.json({
      message: 'Invoice generated successfully',
      invoice: mappedInvoice,
    });
  } catch (error: any) {
    console.error('Error generating invoice:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET invoice details
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const leadId = params.id;

  try {
    // Check authorization - fetch role with join
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

    // Verify user has invoice viewing permissions
    const allowedRoles = ['SUPER_ADMIN', 'SUB_ADMIN', 'WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR'];
    if (!allowedRoles.includes(roleCode)) {
      return NextResponse.json({ 
        error: 'Forbidden: Insufficient permissions',
        current_role: roleCode
      }, { status: 403 });
    }

    // Fetch invoice
    const { data: invoice, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('lead_id', leadId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching invoice:', error);
      throw error;
    }

    // If invoice exists, verify workshop access for workshop staff
    if (invoice && ['WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR'].includes(roleCode)) {
      // Fetch lead to check workshop
      const { data: lead } = await supabase
        .from('service_leads')
        .select('workshop_id')
        .eq('id', leadId)
        .single();

      if (lead && userProfile.workshop_id !== lead.workshop_id) {
        return NextResponse.json({ error: 'Forbidden: Lead not in your workshop' }, { status: 403 });
      }
    }

    if (!invoice) {
      return NextResponse.json({ invoice: null });
    }

    // Fetch creator name if generated_by exists
    if (invoice.generated_by) {
      const { data: creator } = await supabase
        .from('users_login')
        .select('full_name')
        .eq('id', invoice.generated_by)
        .single();
      
      if (creator) {
        invoice.creator = { full_name: creator.full_name };
      }
    }

    // Map database fields to component expected fields - include ALL new fields
    const mappedInvoice = {
      ...invoice,
      // Map field names to match InvoiceSection component expectations
      parts_amount: (invoice as any).parts_cost || 0,
      extra_charges_amount: invoice.extra_charges || 0,
      subtotal: (invoice as any).sub_total || ((invoice.base_amount || 0) + (invoice.extra_charges || 0) - (invoice.discount_amount || invoice.discount || 0)),
      sub_total: (invoice as any).sub_total,
      cgst: (invoice as any).cgst_amount || 0,
      cgst_amount: (invoice as any).cgst_amount || 0,
      sgst: (invoice as any).sgst_amount || 0,
      sgst_amount: (invoice as any).sgst_amount || 0,
      igst: (invoice as any).igst_amount || 0,
      igst_amount: (invoice as any).igst_amount || 0,
      total_tax: (invoice as any).total_tax || 0,
      round_off_amount: (invoice as any).round_off_amount || 0,
      discount_amount: (invoice as any).discount_amount || invoice.discount || 0,
      total_amount: (invoice as any).final_amount || invoice.total_amount || 0,
      final_amount: (invoice as any).final_amount || invoice.total_amount || 0,
      amount_in_words: (invoice as any).amount_in_words,
      invoice_date: (invoice as any).invoice_date || invoice.created_at || new Date().toISOString(),
      due_date: (invoice as any).due_date || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      payment_status: invoice.payment_status || 'PENDING',
      payment_mode: (invoice as any).payment_mode,
      payment_txn_id: (invoice as any).payment_txn_id,
      payment_remarks: (invoice as any).payment_remarks,
      old_parts_handed_over: (invoice as any).old_parts_handed_over,
      old_parts_handed_over_notes: (invoice as any).old_parts_handed_over_notes,
      warranty_info: (invoice as any).warranty_info,
      recommended_future_work: (invoice as any).recommended_future_work,
      invoice_notes: (invoice as any).invoice_notes,
      bank_name: (invoice as any).bank_name,
      bank_account_name: (invoice as any).bank_account_name,
      bank_account_number: (invoice as any).bank_account_number,
      bank_ifsc: (invoice as any).bank_ifsc,
      bank_branch: (invoice as any).bank_branch,
    };

    return NextResponse.json({ invoice: mappedInvoice });
  } catch (error: any) {
    console.error('Error fetching invoice:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

