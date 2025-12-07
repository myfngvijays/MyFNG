import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/payouts/calculate
 * Calculate workshop payout for a period
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
      commission_percentage = 15, // Platform commission
      tds_percentage = 2 // TDS percentage
    } = body;

    if (!workshop_id || !period_start || !period_end) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get all PAID invoices for workshop in period
    const { data: invoices } = await supabase
      .from('invoices')
      .select(`
        *,
        lead:service_leads!inner(
          id, lead_number, workshop_id, status
        )
      `)
      .eq('lead.workshop_id', workshop_id)
      .eq('payment_status', 'PAID')
      .gte('created_at', period_start)
      .lte('created_at', period_end)
      .in('lead.status', ['DELIVERED', 'CLOSED']);

    if (!invoices || invoices.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No paid invoices found for period',
        total_jobs: 0,
        gross_amount: 0,
        net_amount: 0
      });
    }

    // Calculate payout
    const calculation = {
      total_jobs: invoices.length,
      gross_amount: invoices.reduce((sum, inv) => sum + parseFloat(inv.total_amount), 0),
      commission_percentage,
      commission_amount: 0,
      deductions: [] as any[],
      total_deductions: 0,
      net_before_tax: 0,
      tds_percentage,
      tds_amount: 0,
      net_amount: 0,
      job_ids: invoices.map(inv => inv.lead_id),
      breakdown: [] as any[]
    };

    // Calculate commission
    calculation.commission_amount = (calculation.gross_amount * commission_percentage) / 100;
    calculation.deductions.push({
      type: 'PLATFORM_COMMISSION',
      amount: calculation.commission_amount,
      percentage: commission_percentage
    });

    // Check for penalties/deductions (simplified - can be enhanced)
    calculation.total_deductions = calculation.commission_amount;
    calculation.net_before_tax = calculation.gross_amount - calculation.total_deductions;

    // Calculate TDS
    calculation.tds_amount = (calculation.net_before_tax * tds_percentage) / 100;
    calculation.net_amount = calculation.net_before_tax - calculation.tds_amount;

    // Per-invoice breakdown
    calculation.breakdown = invoices.map(inv => ({
      invoice_id: inv.id,
      invoice_number: inv.invoice_number,
      lead_number: (inv.lead as any).lead_number,
      invoice_amount: parseFloat(inv.total_amount),
      commission: (parseFloat(inv.total_amount) * commission_percentage) / 100,
      net_amount: parseFloat(inv.total_amount) - ((parseFloat(inv.total_amount) * commission_percentage) / 100)
    }));

    return NextResponse.json({
      success: true,
      calculation
    });

  } catch (error: any) {
    console.error('Payout calculation error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}
