import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/reconciliation/exceptions
 * Get unmatched/exception payments
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') || 'PENDING';

    const { data: exceptions } = await supabase
      .from('recon_exceptions')
      .select(`
        *,
        payment:payment_transactions(*),
        invoice:invoices(*),
        lead:service_leads(lead_number, customer_name)
      `)
      .eq('status', status)
      .order('created_at', { ascending: false });

    return NextResponse.json({
      success: true,
      exceptions: exceptions || []
    });

  } catch (error: any) {
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}
