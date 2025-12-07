import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/reconciliation/settlement-report
 * Generate daily settlement report
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
      report_date = new Date().toISOString().split('T')[0],
      provider = 'ALL'
    } = body;

    // Get all payments for the date
    const { data: payments, count } = await supabase
      .from('payment_transactions')
      .select('*', { count: 'exact' })
      .eq('status', 'SUCCESS')
      .gte('completed_at', `${report_date}T00:00:00`)
      .lte('completed_at', `${report_date}T23:59:59`);

    const totalAmount = payments?.reduce((sum, p) => sum + parseFloat(p.amount), 0) || 0;
    const matchedCount = payments?.filter(p => p.reconciled).length || 0;
    const unmatchedCount = (count || 0) - matchedCount;

    // Create settlement report
    const { data: report } = await supabase
      .from('settlement_reports')
      .insert({
        report_date,
        report_type: 'DAILY',
        provider,
        total_amount: totalAmount,
        total_transactions: count || 0,
        matched_count: matchedCount,
        unmatched_count: unmatchedCount,
        status: 'PROCESSED',
        processed_at: new Date().toISOString(),
        processed_by: user.id,
        metadata: {
          payments: payments?.map(p => p.id)
        }
      })
      .select()
      .single();

    return NextResponse.json({
      success: true,
      report
    });

  } catch (error: any) {
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}

