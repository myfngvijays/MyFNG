import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/reconciliation/exceptions/[id]/resolve
 * Manually resolve reconciliation exception
 */
export async function POST(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const exceptionId = params.id;
    const body = await request.json();
    const { resolution_notes, matched_payment_id = null } = body;

    const now = new Date().toISOString();

    // Update exception
    const { data: resolved } = await supabase
      .from('recon_exceptions')
      .update({
        status: 'RESOLVED',
        resolved_by: user.id,
        resolved_at: now,
        resolution_notes
      })
      .eq('id', exceptionId)
      .select()
      .single();

    // If matched with a payment, mark payment as reconciled
    if (matched_payment_id) {
      await supabase
        .from('payment_transactions')
        .update({
          reconciled: true,
          reconciled_at: now,
          reconciled_by: user.id
        })
        .eq('id', matched_payment_id);
    }

    return NextResponse.json({
      success: true,
      exception: resolved
    });

  } catch (error: any) {
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}

