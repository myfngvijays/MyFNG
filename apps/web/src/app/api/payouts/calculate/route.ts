/**
 * Calculate Payout API
 * Phase 3 - Step 9: Workshop Payout Scheduling
 * Purpose: Calculate workshop payout for a given period
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
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

    // Verify user has finance permissions
    const allowedRoles = ['super_admin', 'sub_admin', 'finance_manager', 'accounts'];
    if (!allowedRoles.includes(userProfile.role)) {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const {
      workshop_id,
      period_start,
      period_end,
      commission_percentage = 15.00, // Default 15%
      tds_percentage = 0,
    } = body;

    if (!workshop_id || !period_start || !period_end) {
      return NextResponse.json({
        error: 'Missing required fields: workshop_id, period_start, period_end',
      }, { status: 400 });
    }

    // Get all paid invoices for the workshop in the period
    const { data: invoices, error: invoicesError } = await supabase
      .from('invoices')
      .select(`
        id,
        invoice_number,
        lead_id,
        final_amount,
        paid_amount,
        payment_status,
        paid_at
      `)
      .eq('workshop_id', workshop_id)
      .eq('payment_status', 'PAID')
      .gte('paid_at', period_start)
      .lte('paid_at', period_end)
      .is('payout_processed', null); // Not already processed

    if (invoicesError) {
      console.error('Error fetching invoices:', invoicesError);
      return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 });
    }

    if (!invoices || invoices.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No invoices found for payout calculation',
        payout: {
          workshop_id,
          period_start,
          period_end,
          total_invoices: 0,
          total_amount: 0,
          net_payout: 0,
        },
      }, { status: 200 });
    }

    // Calculate payout for each invoice
    const payoutItems: any[] = [];
    let totalInvoiceAmount = 0;
    let totalCommission = 0;
    let totalTDS = 0;

    for (const invoice of invoices) {
      const invoiceAmount = parseFloat(invoice.final_amount || invoice.paid_amount || '0');
      const commissionAmount = (invoiceAmount * commission_percentage) / 100;
      const tdsAmount = (invoiceAmount * tds_percentage) / 100;
      const netAmount = invoiceAmount - commissionAmount - tdsAmount;

      totalInvoiceAmount += invoiceAmount;
      totalCommission += commissionAmount;
      totalTDS += tdsAmount;

      payoutItems.push({
        lead_id: invoice.lead_id,
        invoice_id: invoice.id,
        invoice_amount: invoiceAmount,
        commission_percentage: commission_percentage,
        commission_amount: commissionAmount,
        tds_percentage: tds_percentage,
        tds_amount: tdsAmount,
        net_amount: netAmount,
      });
    }

    const netPayoutAmount = totalInvoiceAmount - totalCommission - totalTDS;

    // Generate payout number
    const payoutNumber = `PAYOUT-${workshop_id.substring(0, 8)}-${Date.now().toString().slice(-6)}`;

    return NextResponse.json({
      success: true,
      payout_calculation: {
        workshop_id,
        payout_number: payoutNumber,
        period_start,
        period_end,
        total_invoices: invoices.length,
        total_invoice_amount: totalInvoiceAmount,
        commission_percentage: commission_percentage,
        commission_amount: totalCommission,
        tds_percentage: tds_percentage,
        tds_amount: totalTDS,
        net_payout_amount: netPayoutAmount,
        payout_items: payoutItems,
        invoice_ids: invoices.map((inv) => inv.id),
        lead_ids: invoices.map((inv) => inv.lead_id),
      },
      next_step: 'Create payout batch and get approval',
    }, { status: 200 });

  } catch (error) {
    console.error('Error in calculate payout API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

