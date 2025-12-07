import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/chargebacks
 * Get chargeback cases with filters
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') || 'RECEIVED';

    let query = supabase
      .from('chargeback_cases')
      .select(`
        *,
        payment:payment_transactions(*),
        invoice:invoices(invoice_number),
        lead:service_leads(lead_number, customer_name)
      `)
      .order('created_at', { ascending: false });

    if (status !== 'ALL') {
      query = query.eq('status', status);
    }

    const { data: cases, error } = await query;

    if (error) {
      console.error('Error fetching chargebacks:', error);
      return NextResponse.json({ 
        error: 'Failed to fetch chargebacks',
        details: error.message
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      cases: cases || []
    });

  } catch (error: any) {
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}

