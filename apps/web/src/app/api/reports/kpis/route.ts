/**
 * KPI Reports API
 * Phase 4 - Step 12: Reporting & KPIs Update
 * Purpose: Calculate and return key performance indicators
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'daily'; // daily, weekly, monthly
    const workshop_id = searchParams.get('workshop_id');

    // Calculate date range
    const now = new Date();
    let startDate: Date;
    
    if (period === 'daily') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (period === 'weekly') {
      const dayOfWeek = now.getDay();
      startDate = new Date(now.getTime() - (dayOfWeek * 24 * 60 * 60 * 1000));
      startDate.setHours(0, 0, 0, 0);
    } else { // monthly
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    // Revenue KPIs
    let revenueQuery = supabase
      .from('invoices')
      .select('final_amount, payment_status, paid_amount')
      .eq('payment_status', 'PAID')
      .gte('paid_at', startDate.toISOString());

    if (workshop_id) {
      revenueQuery = revenueQuery.eq('workshop_id', workshop_id);
    }

    const { data: paidInvoices } = await revenueQuery;

    const totalRevenue = paidInvoices?.reduce((sum, inv) => sum + parseFloat(inv.paid_amount || inv.final_amount || '0'), 0) || 0;
    const totalInvoices = paidInvoices?.length || 0;
    const averageInvoiceValue = totalInvoices > 0 ? totalRevenue / totalInvoices : 0;

    // DSO (Days Sales Outstanding) - Average days to collect payment
    const { data: allInvoices } = await supabase
      .from('invoices')
      .select('created_at, paid_at, final_amount')
      .eq('payment_status', 'PAID')
      .gte('paid_at', startDate.toISOString())
      .not('paid_at', 'is', null);

    let totalDays = 0;
    let invoiceCount = 0;
    allInvoices?.forEach((inv) => {
      if (inv.created_at && inv.paid_at) {
        const created = new Date(inv.created_at);
        const paid = new Date(inv.paid_at);
        const days = Math.floor((paid.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
        totalDays += days;
        invoiceCount++;
      }
    });
    const dso = invoiceCount > 0 ? totalDays / invoiceCount : 0;

    // Collection Rate
    const { data: allPeriodInvoices } = await supabase
      .from('invoices')
      .select('final_amount, payment_status')
      .gte('created_at', startDate.toISOString());

    const totalInvoiceAmount = allPeriodInvoices?.reduce((sum, inv) => sum + parseFloat(inv.final_amount || '0'), 0) || 0;
    const collectionRate = totalInvoiceAmount > 0 ? (totalRevenue / totalInvoiceAmount) * 100 : 0;

    // CSAT (Customer Satisfaction)
    const { data: followUps } = await supabase
      .from('cse_followups')
      .select('satisfaction_score')
      .gte('completed_at', startDate.toISOString())
      .not('satisfaction_score', 'is', null);

    const totalCSAT = followUps?.reduce((sum, f) => sum + (f.satisfaction_score || 0), 0) || 0;
    const csatCount = followUps?.length || 0;
    const averageCSAT = csatCount > 0 ? totalCSAT / csatCount : 0;

    // Refund Rate
    const { data: refunds } = await supabase
      .from('refund_requests')
      .select('refund_amount, status')
      .gte('created_at', startDate.toISOString())
      .eq('status', 'COMPLETED');

    const totalRefunds = refunds?.reduce((sum, r) => sum + parseFloat(r.refund_amount || '0'), 0) || 0;
    const refundRate = totalRevenue > 0 ? (totalRefunds / totalRevenue) * 100 : 0;

    // Payout Summary
    let payoutQuery = supabase
      .from('workshop_payouts')
      .select('amount, status')
      .gte('created_at', startDate.toISOString());

    if (workshop_id) {
      payoutQuery = payoutQuery.eq('workshop_id', workshop_id);
    }

    const { data: payouts } = await payoutQuery;
    const totalPayouts = payouts?.filter(p => p.status === 'COMPLETED').reduce((sum, p) => sum + parseFloat(p.amount || '0'), 0) || 0;

    // SLA Breaches
    // TODO: Calculate based on lead SLA tracking

    return NextResponse.json({
      success: true,
      period: period,
      kpis: {
        revenue: {
          total_revenue: totalRevenue,
          total_invoices: totalInvoices,
          average_invoice_value: averageInvoiceValue,
          collection_rate: collectionRate,
        },
        efficiency: {
          dso: dso.toFixed(1), // Days Sales Outstanding
          average_collection_days: dso.toFixed(1),
        },
        customer_satisfaction: {
          average_csat: averageCSAT.toFixed(2),
          total_followups: csatCount,
        },
        financial: {
          total_refunds: totalRefunds,
          refund_rate: refundRate.toFixed(2),
          total_payouts: totalPayouts,
          net_revenue: totalRevenue - totalRefunds,
        },
      },
      generated_at: new Date().toISOString(),
    }, { status: 200 });

  } catch (error) {
    console.error('Error in KPI reports API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

