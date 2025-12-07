import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { createFinanceEvent } from '@/lib/services/financeEventService';

export const dynamic = 'force-dynamic';

/**
 * POST /api/payouts/create-batch
 * Create payout batch with approval workflow
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      workshop_id,
      period_start,
      period_end,
      calculation // From /calculate endpoint
    } = body;

    // Get workshop bank details
    const { data: workshop } = await supabase
      .from('workshops')
      .select('*')
      .eq('id', workshop_id)
      .single();

    if (!workshop) {
      return NextResponse.json({ error: 'Workshop not found' }, { status: 404 });
    }

    // Create payout batch
    const batchId = `BATCH-${Date.now()}`;
    const { data: payout, error: payoutError } = await supabase
      .from('workshop_payouts')
      .insert({
        workshop_id,
        amount: calculation.gross_amount,
        payout_period_start: period_start,
        payout_period_end: period_end,
        total_jobs: calculation.total_jobs,
        job_ids: calculation.job_ids,
        status: 'PENDING',
        bank_account_number: workshop.bank_account_number,
        bank_ifsc_code: workshop.bank_ifsc,
        bank_name: workshop.bank_name,
        calculation_breakdown: calculation,
        deductions: calculation.deductions,
        tds_amount: calculation.tds_amount,
        tds_percentage: calculation.tds_percentage,
        net_amount_after_tax: calculation.net_amount,
        payout_batch_id: batchId,
        created_by: user.id
      })
      .select()
      .single();

    if (payoutError) {
      console.error('Payout creation error:', payoutError);
      return NextResponse.json({ 
        error: 'Failed to create payout',
        details: payoutError.message
      }, { status: 500 });
    }

    // Create payout items
    const payoutItems = calculation.breakdown.map((item: any) => ({
      payout_id: payout.id,
      lead_id: item.lead_id || calculation.job_ids[0], // Simplified
      invoice_id: item.invoice_id,
      invoice_amount: item.invoice_amount,
      commission_percentage: calculation.commission_percentage,
      commission_amount: item.commission,
      net_amount: item.net_amount,
      deductions: {}
    }));

    await supabase
      .from('payout_items')
      .insert(payoutItems);

    // Create finance event
    await createFinanceEvent({
      event_type: 'payout_batch_created',
      entity_type: 'payout',
      entity_id: payout.id,
      actor_id: user.id,
      event_data: {
        payout_id: payout.id,
        workshop_id,
        amount: calculation.net_amount,
        total_jobs: calculation.total_jobs,
        batch_id: batchId
      }
    });

    return NextResponse.json({
      success: true,
      payout,
      message: 'Payout batch created. Awaiting approval.'
    });

  } catch (error: any) {
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}

