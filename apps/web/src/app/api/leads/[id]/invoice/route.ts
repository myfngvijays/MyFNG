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
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const leadId = params.id;

  try {
    // Fetch lead details with all related data
    const { data: lead, error: leadError } = await supabase
      .from('service_leads')
      .select(`
        *,
        workshop:workshops!workshop_id(name, address, phone, email, gst_number)
      `)
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Check authorization
    const { data: userProfile } = await supabase
      .from('users_login')
      .select('role_id, workshop_id')
      .eq('id', user.id)
      .single();

    if (!userProfile || userProfile.workshop_id !== lead.workshop_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check if lead status allows invoice generation
    if (!['READY_FOR_DELIVERY', 'DELIVERED', 'CLOSED'].includes(lead.status)) {
      return NextResponse.json(
        { error: 'Invoice can only be generated for completed leads' },
        { status: 400 }
      );
    }

    // Check if invoice already exists
    const { data: existingInvoice } = await supabase
      .from('invoices')
      .select('*')
      .eq('lead_id', leadId)
      .single();

    if (existingInvoice) {
      return NextResponse.json(
        { error: 'Invoice already generated', invoice: existingInvoice },
        { status: 409 }
      );
    }

    // Fetch job card and parts
    const { data: jobCard } = await supabase
      .from('job_cards')
      .select('*, job_card_parts(*)')
      .eq('lead_id', leadId)
      .single();

    // Fetch approved extra charges
    const { data: extraCharges } = await supabase
      .from('lead_extra_charges')
      .select('*')
      .eq('lead_id', leadId)
      .eq('status', 'APPROVED');

    // Calculate amounts
    const baseAmount = lead.estimated_cost || 0;
    const partsTotal = jobCard?.job_card_parts?.reduce(
      (sum: number, part: any) => sum + part.total_price,
      0
    ) || 0;
    const extraChargesTotal = extraCharges?.reduce(
      (sum, charge) => sum + charge.amount,
      0
    ) || 0;

    const subtotal = baseAmount + partsTotal + extraChargesTotal;
    const cgst = subtotal * 0.09; // 9% CGST
    const sgst = subtotal * 0.09; // 9% SGST
    const totalAmount = subtotal + cgst + sgst;

    // Generate invoice number
    const invoiceNumber = `INV-${lead.lead_number}-${Date.now().toString().slice(-6)}`;

    // Create invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        lead_id: leadId,
        invoice_number: invoiceNumber,
        base_amount: baseAmount,
        parts_amount: partsTotal,
        extra_charges_amount: extraChargesTotal,
        subtotal: subtotal,
        cgst: cgst,
        sgst: sgst,
        total_amount: totalAmount,
        invoice_date: new Date().toISOString(),
        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
        payment_status: 'PENDING',
        created_by: user.id,
      })
      .select()
      .single();

    if (invoiceError) {
      console.error('Error creating invoice:', invoiceError);
      return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 });
    }

    // Update lead with final amount
    await supabase
      .from('service_leads')
      .update({ final_amount: totalAmount })
      .eq('id', leadId);

    // Create event
    await supabase.from('lead_events').insert({
      lead_id: leadId,
      event_type: 'INVOICE_GENERATED',
      event_description: `Invoice ${invoiceNumber} generated - ₹${totalAmount.toFixed(2)}`,
      event_data: {
        invoice_id: invoice.id,
        invoice_number: invoiceNumber,
        total_amount: totalAmount,
      },
      created_by: user.id,
    });

    return NextResponse.json({
      message: 'Invoice generated successfully',
      invoice,
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
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const leadId = params.id;

  try {
    const { data: invoice, error } = await supabase
      .from('invoices')
      .select(`
        *,
        lead:service_leads!lead_id(*),
        creator:created_by(full_name)
      `)
      .eq('lead_id', leadId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    return NextResponse.json({ invoice });
  } catch (error: any) {
    console.error('Error fetching invoice:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

