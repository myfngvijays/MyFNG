/**
 * Update Invoice Details API
 * Allows updating invoice fields like old_parts_handed_over, warranty_info, notes, etc.
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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
      .select('id, role_id, workshop_id, roles(role_code, role_name)')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Get role code
    const roleCode = (userProfile.roles as any)?.role_code;

    // Verify user has billing permissions
    const allowedRoles = ['SUPER_ADMIN', 'SUB_ADMIN', 'WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR', 'BILLING'];
    if (!allowedRoles.includes(roleCode)) {
      return NextResponse.json({ 
        error: 'Forbidden: Insufficient permissions',
        current_role: roleCode
      }, { status: 403 });
    }

    const { id: invoiceId } = await params;
    if (!invoiceId || !isUuid(String(invoiceId))) {
      return NextResponse.json({ error: 'Invalid invoice id' }, { status: 400 });
    }
    const body = await request.json();

    // Get invoice to verify it exists
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('id, workshop_id, status, lead_id')
      .eq('id', invoiceId)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Verify user belongs to the same workshop (for workshop staff)
    if (['WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR'].includes(roleCode)) {
      if (!userProfile.workshop_id || userProfile.workshop_id !== invoice.workshop_id) {
        return NextResponse.json({ error: 'Forbidden: Invoice not in your workshop' }, { status: 403 });
      }
    }

    // Only allow updates if invoice is not PAID or CANCELLED
    if (['PAID', 'CANCELLED'].includes(invoice.status)) {
      return NextResponse.json({ 
        error: 'Cannot update invoice details',
        reason: `Invoice is ${invoice.status}`
      }, { status: 400 });
    }

    // Prepare update data (only allow specific fields)
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    // Old parts handed over
    if (body.old_parts_handed_over !== undefined) {
      updateData.old_parts_handed_over = body.old_parts_handed_over;
    }
    if (body.old_parts_handed_over_notes !== undefined) {
      updateData.old_parts_handed_over_notes = body.old_parts_handed_over_notes;
    }

    // Warranty info
    if (body.warranty_info !== undefined) {
      updateData.warranty_info = body.warranty_info;
    }

    // Invoice notes
    if (body.invoice_notes !== undefined) {
      updateData.invoice_notes = body.invoice_notes;
    }

    // Recommended future work
    if (body.recommended_future_work !== undefined) {
      updateData.recommended_future_work = body.recommended_future_work;
    }

    // Payment terms
    if (body.payment_terms !== undefined) {
      updateData.payment_terms = body.payment_terms;
    }

    // Due date
    if (body.due_date !== undefined) {
      updateData.due_date = body.due_date;
    }

    // Customer address (for invoice display)
    if (body.customer_address !== undefined) {
      updateData.customer_address = body.customer_address;
    }
    if (body.customer_city !== undefined) {
      updateData.customer_city = body.customer_city;
    }
    if (body.customer_state !== undefined) {
      updateData.customer_state = body.customer_state;
    }
    if (body.customer_pincode !== undefined) {
      updateData.customer_pincode = body.customer_pincode;
    }

    // Bank details
    if (body.bank_name !== undefined) {
      updateData.bank_name = body.bank_name;
    }
    if (body.bank_account_name !== undefined) {
      updateData.bank_account_name = body.bank_account_name;
    }
    if (body.bank_account_number !== undefined) {
      updateData.bank_account_number = body.bank_account_number;
    }
    if (body.bank_ifsc !== undefined) {
      updateData.bank_ifsc = body.bank_ifsc;
    }
    if (body.bank_branch !== undefined) {
      updateData.bank_branch = body.bank_branch;
    }

    // Update invoice
    const { data: updatedInvoice, error: updateError } = await supabase
      .from('invoices')
      .update(updateData)
      .eq('id', invoiceId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating invoice:', updateError);
      return NextResponse.json({ 
        error: 'Failed to update invoice',
        details: updateError.message 
      }, { status: 500 });
    }

    // Log activity if lead_id exists
    if (invoice.lead_id) {
      await supabase
        .from('lead_activities')
        .insert({
          lead_id: invoice.lead_id,
          user_id: userProfile.id,
          activity_type: 'INVOICE_UPDATED',
          description: 'Invoice details updated',
          metadata: {
            invoice_id: invoiceId,
            updated_fields: Object.keys(updateData).filter(key => key !== 'updated_at'),
            updated_by: userProfile.id,
            updated_at: updateData.updated_at,
          },
        });
    }

    return NextResponse.json({
      success: true,
      message: 'Invoice details updated successfully',
      invoice: updatedInvoice,
    }, { status: 200 });

  } catch (error) {
    console.error('Error in update invoice details API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

