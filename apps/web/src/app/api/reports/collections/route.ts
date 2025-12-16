/**
 * Daily Collections Report API
 * Phase 4 - Step 12: Reporting & KPIs
 * Purpose: Daily payment collections report
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
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const workshop_id = searchParams.get('workshop_id');

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Get all payments for the day
    let paymentsQuery = supabase
      .from('payment_transactions')
      .select(`
        *,
        invoice:invoices!invoice_id(
          id,
          invoice_number,
          workshop_id,
          lead_id
        ),
        lead:service_leads!lead_id(
          id,
          lead_number,
          customer_name
        )
      `)
      .eq('status', 'SUCCESS')
      .gte('created_at', startOfDay.toISOString())
      .lte('created_at', endOfDay.toISOString())
      .order('created_at', { ascending: false });

    if (workshop_id) {
      paymentsQuery = paymentsQuery.eq('invoice.workshop_id', workshop_id);
    }

    const { data: payments } = await paymentsQuery;

    // Group by payment method
    const byMethod = payments?.reduce((acc: any, payment: any) => {
      const method = payment.payment_method || 'UNKNOWN';
      if (!acc[method]) {
        acc[method] = { count: 0, amount: 0, payments: [] };
      }
      acc[method].count++;
      acc[method].amount += parseFloat(payment.amount || '0');
      acc[method].payments.push(payment);
      return acc;
    }, {}) || {};

    // Calculate totals
    const totalAmount = payments?.reduce((sum, p) => sum + parseFloat(p.amount || '0'), 0) || 0;
    const totalCount = payments?.length || 0;

    // Cash vs Online
    const cashAmount = byMethod['CASH']?.amount || 0;
    const onlineAmount = totalAmount - cashAmount;
    const cashCount = byMethod['CASH']?.count || 0;
    const onlineCount = totalCount - cashCount;

    return NextResponse.json({
      success: true,
      date: date,
      summary: {
        total_collections: totalAmount,
        total_transactions: totalCount,
        cash: {
          amount: cashAmount,
          count: cashCount,
          percentage: totalAmount > 0 ? (cashAmount / totalAmount) * 100 : 0,
        },
        online: {
          amount: onlineAmount,
          count: onlineCount,
          percentage: totalAmount > 0 ? (onlineAmount / totalAmount) * 100 : 0,
        },
      },
      by_method: byMethod,
      payments: payments || [],
      generated_at: new Date().toISOString(),
    }, { status: 200 });

  } catch (error) {
    console.error('Error in collections report API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

