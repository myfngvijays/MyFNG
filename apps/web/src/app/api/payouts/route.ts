import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/payouts
 * Get workshop payouts with filters
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
    const workshop_id = searchParams.get('workshop_id');

    let query = supabase
      .from('workshop_payouts')
      .select(`
        *,
        workshop:workshops(name, city)
      `)
      .order('created_at', { ascending: false });

    if (status !== 'ALL') {
      query = query.eq('status', status);
    }

    if (workshop_id) {
      query = query.eq('workshop_id', workshop_id);
    }

    const { data: payouts, error } = await query;

    if (error) {
      console.error('Error fetching payouts:', error);
      return NextResponse.json({ 
        error: 'Failed to fetch payouts',
        details: error.message
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      payouts: payouts || []
    });

  } catch (error: any) {
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}
