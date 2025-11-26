/**
 * Revenue Reports API
 * Phase 4 - Step 12: Reporting & KPIs
 * Purpose: Generate revenue reports with DSO calculation
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'monthly'; // daily, weekly, monthly, yearly
    const workshop_id = searchParams.get('workshop_id');
    const start_date = searchParams.get('start_date');
    const end_date = searchParams.get('end_date');

    // Calculate date range
    const now = new Date();
    let startDate: Date;
    let endDate: Date = now;

    if (start_date && end_date) {
      startDate = new Date(start_date);
      endDate = new Date(end_date);
    } else if (period === 'daily') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (period === 'weekly') {
      const dayOfWeek = now.getDay();
      startDate = new Date(now.getTime() - (dayOfWeek * 24 * 60 * 60 * 1000));
      startDate.setHours(0, 0, 0, 0);
    } else if (period === 'monthly') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else { // yearly
      startDate = new Date(now.getFullYear(), 0, 1);
    }

    // Revenue by payment status
    let revenueQuery = supabase
      .from('invoices')
      .select('final_amount, payment_status, paid_amount, created_at, paid_at')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    if (workshop_id) {
      revenueQuery = revenueQuery.eq('workshop_id', workshop_id);
    }

    const { data: invoices } = await revenueQuery;

    // Calculate metrics
    const totalInvoiced = invoices?.reduce((sum, inv) => sum + parseFloat(inv.final_amount || '0'), 0) || 0;
    const totalPaid = invoices?.filter(inv => inv.payment_status === 'PAID')
      .reduce((sum, inv) => sum + parseFloat(inv.paid_amount || inv.final_amount || '0'), 0) || 0;
    const totalPending = invoices?.filter(inv => inv.payment_status === 'PENDING' || inv.payment_status === 'PARTIAL')
      .reduce((sum, inv) => sum + parseFloat(inv.final_amount || '0'), 0) || 0;

    // DSO Calculation
    const paidInvoices = invoices?.filter(inv => inv.payment_status === 'PAID' && inv.created_at && inv.paid_at) || [];
    let totalDays = 0;
    paidInvoices.forEach((inv) => {
      const created = new Date(inv.created_at);
      const paid = new Date(inv.paid_at!);
      const days = Math.floor((paid.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
      totalDays += days;
    });
    const dso = paidInvoices.length > 0 ? totalDays / paidInvoices.length : 0;

    // Revenue by day/week/month
    const revenueByPeriod: any = {};
    invoices?.forEach((inv) => {
      const date = new Date(inv.created_at);
      let key: string;
      
      if (period === 'daily') {
        key = date.toISOString().split('T')[0];
      } else if (period === 'weekly') {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split('T')[0];
      } else if (period === 'monthly') {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      } else {
        key = String(date.getFullYear());
      }

      if (!revenueByPeriod[key]) {
        revenueByPeriod[key] = { invoiced: 0, paid: 0, pending: 0 };
      }

      revenueByPeriod[key].invoiced += parseFloat(inv.final_amount || '0');
      if (inv.payment_status === 'PAID') {
        revenueByPeriod[key].paid += parseFloat(inv.paid_amount || inv.final_amount || '0');
      } else {
        revenueByPeriod[key].pending += parseFloat(inv.final_amount || '0');
      }
    });

    return NextResponse.json({
      success: true,
      period: period,
      date_range: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
      revenue: {
        total_invoiced: totalInvoiced,
        total_paid: totalPaid,
        total_pending: totalPending,
        collection_rate: totalInvoiced > 0 ? (totalPaid / totalInvoiced) * 100 : 0,
        dso: dso.toFixed(1), // Days Sales Outstanding
      },
      revenue_by_period: revenueByPeriod,
      invoice_count: {
        total: invoices?.length || 0,
        paid: invoices?.filter(inv => inv.payment_status === 'PAID').length || 0,
        pending: invoices?.filter(inv => inv.payment_status === 'PENDING' || inv.payment_status === 'PARTIAL').length || 0,
      },
      generated_at: new Date().toISOString(),
    }, { status: 200 });

  } catch (error) {
    console.error('Error in revenue reports API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

