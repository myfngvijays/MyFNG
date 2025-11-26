/**
 * Create Payout Batch API
 * Phase 3 - Step 9: Workshop Payout Scheduling
 * Purpose: Create payout batch with CSV generation
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { createFinanceEvent } from '@/lib/services/financeEventService';

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
      .select('id, role, name')
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
      payout_number,
      period_start,
      period_end,
      total_invoice_amount,
      commission_amount,
      tds_amount,
      net_payout_amount,
      payout_items,
      invoice_ids,
      lead_ids,
    } = body;

    if (!workshop_id || !payout_number || !net_payout_amount) {
      return NextResponse.json({
        error: 'Missing required fields',
      }, { status: 400 });
    }

    // Get workshop details
    const { data: workshop, error: workshopError } = await supabase
      .from('workshops')
      .select('id, name, bank_account_number, bank_ifsc_code, bank_name')
      .eq('id', workshop_id)
      .single();

    if (workshopError || !workshop) {
      return NextResponse.json({ error: 'Workshop not found' }, { status: 404 });
    }

    const now = new Date().toISOString();

    // Create payout record
    const { data: payout, error: payoutError } = await supabase
      .from('workshop_payouts')
      .insert({
        workshop_id: workshop_id,
        amount: net_payout_amount,
        payout_period_start: period_start,
        payout_period_end: period_end,
        total_jobs: invoice_ids?.length || 0,
        job_ids: invoice_ids || [],
        status: 'PENDING',
        calculation_breakdown: {
          total_invoice_amount: total_invoice_amount,
          commission_amount: commission_amount,
          tds_amount: tds_amount,
          net_payout_amount: net_payout_amount,
        },
        bank_account_number: workshop.bank_account_number,
        bank_ifsc_code: workshop.bank_ifsc_code,
        bank_name: workshop.bank_name,
        created_by: userProfile.id,
      })
      .select()
      .single();

    if (payoutError) {
      console.error('Error creating payout:', payoutError);
      return NextResponse.json({ error: 'Failed to create payout' }, { status: 500 });
    }

    // Create payout items
    if (payout_items && payout_items.length > 0) {
      const itemsToInsert = payout_items.map((item: any) => ({
        payout_id: payout.id,
        lead_id: item.lead_id,
        invoice_id: item.invoice_id,
        invoice_amount: item.invoice_amount,
        commission_percentage: item.commission_percentage,
        commission_amount: item.commission_amount,
        net_amount: item.net_amount,
        deductions: {
          tds_percentage: item.tds_percentage,
          tds_amount: item.tds_amount,
        },
      }));

      await supabase
        .from('payout_items')
        .insert(itemsToInsert);
    }

    // Generate CSV content
    const csvRows = [
      ['Payout Number', 'Workshop', 'Period', 'Net Amount', 'Bank Account', 'IFSC'],
      [
        payout_number,
        workshop.name,
        `${period_start} to ${period_end}`,
        net_payout_amount.toFixed(2),
        workshop.bank_account_number || '',
        workshop.bank_ifsc_code || '',
      ],
    ];

    const csvContent = csvRows.map((row) => row.join(',')).join('\n');

    // Store CSV (in production, upload to S3/storage)
    const csvFileName = `payout-${payout_number}-${Date.now()}.csv`;
    const csvFileUrl = `/api/payouts/batch/${payout.id}/download-csv`; // Placeholder

    // Update payout with CSV URL
    await supabase
      .from('workshop_payouts')
      .update({
        csv_file_url: csvFileUrl,
        payout_batch_id: payout.id, // Self-reference for batch
        updated_at: now,
      })
      .eq('id', payout.id);

    // Create finance event
    await createFinanceEvent({
      eventType: 'payout_created',
      entityType: 'payout',
      entityId: payout.id,
      actorId: userProfile.id,
      actorRole: userProfile.role,
      actorName: userProfile.name,
      eventData: {
        payout_number: payout_number,
        workshop_id: workshop_id,
        net_payout_amount: net_payout_amount,
        total_invoices: invoice_ids?.length || 0,
        period_start: period_start,
        period_end: period_end,
      },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({
      success: true,
      message: 'Payout batch created successfully',
      payout: payout,
      csv_file_url: csvFileUrl,
      csv_content: csvContent, // For immediate download
      next_step: 'Awaiting Finance Manager approval',
    }, { status: 201 });

  } catch (error) {
    console.error('Error in create payout batch API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

