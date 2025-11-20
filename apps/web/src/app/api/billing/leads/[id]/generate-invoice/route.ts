import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

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

    // Get user profile
    const { data: userProfile, error: profileError } = await supabase
      .from('users_login')
      .select('id, role')
      .eq('email', user.email)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Verify user has billing permissions
    const allowedRoles = ['super_admin', 'sub_admin', 'workshop_admin'];
    if (!allowedRoles.includes(userProfile.role)) {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
    }

    const leadId = params.id;

    // Get lead details
    const { data: lead, error: leadError } = await supabase
      .from('service_leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Verify lead is ready for billing
    const validStatuses = ['QC_APPROVED', 'READY_FOR_BILLING', 'AUDIT_APPROVED'];
    if (!validStatuses.includes(lead.status)) {
      return NextResponse.json({ 
        error: 'Lead not ready for billing',
        current_status: lead.status,
        hint: 'Lead must be QC approved or audit approved'
      }, { status: 400 });
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

    // Get all approved extra charges
    const { data: extraCharges } = await supabase
      .from('lead_extra_charges')
      .select('amount')
      .eq('lead_id', leadId)
      .eq('status', 'APPROVED');

    const extraChargesTotal = extraCharges?.reduce((sum, charge) => sum + parseFloat(charge.amount), 0) || 0;

    // Calculate amounts
    const baseAmount = parseFloat(lead.estimated_amount || '0');
    const discount = parseFloat(lead.discount_amount || '0');
    const taxRate = 0.18; // 18% GST
    const subtotal = baseAmount + extraChargesTotal - discount;
    const taxAmount = subtotal * taxRate;
    const finalAmount = subtotal + taxAmount;

    // Generate invoice number
    const invoiceNumber = `INV-${Date.now()}-${leadId.substring(0, 8).toUpperCase()}`;

    const now = new Date().toISOString();

    // Create invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        lead_id: leadId,
        workshop_id: lead.workshop_id,
        invoice_number: invoiceNumber,
        base_amount: baseAmount,
        extra_charges: extraChargesTotal,
        discount: discount,
        tax_amount: taxAmount,
        total_amount: finalAmount,
        payment_status: 'PENDING',
        status: 'GENERATED',
        generated_by: userProfile.id,
        created_at: now
      })
      .select()
      .single();

    if (invoiceError) {
      console.error('Error creating invoice:', invoiceError);
      return NextResponse.json({ error: 'Failed to generate invoice' }, { status: 500 });
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
          tax_amount: taxAmount,
          final_amount: finalAmount,
          generated_by: userProfile.id,
          generated_at: now
        }
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
        extra_charges: extraChargesTotal,
        discount: discount,
        subtotal: subtotal,
        tax_amount: taxAmount,
        final_amount: finalAmount
      },
      next_step: 'Send invoice to customer and await payment'
    }, { status: 201 });

  } catch (error) {
    console.error('Error in generate invoice API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

