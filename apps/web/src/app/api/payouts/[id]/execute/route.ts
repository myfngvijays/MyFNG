import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { createFinanceEvent } from '@/lib/services/financeEventService';

export const dynamic = 'force-dynamic';

/**
 * POST /api/payouts/[id]/execute
 * Execute approved payout (bank transfer)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile } = await supabase
      .from('users_login')
      .select('id, roles!inner(role_code)')
      .eq('id', user.id)
      .single();

    const roleCode = (userProfile?.roles as any)?.role_code;
    if (!['SUPER_ADMIN', 'FINANCE_MANAGER'].includes(roleCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const payoutId = params.id;

    // Get payout
    const { data: payout } = await supabase
      .from('workshop_payouts')
      .select('*, workshop:workshops(*)')
      .eq('id', payoutId)
      .single();

    if (!payout) {
      return NextResponse.json({ error: 'Payout not found' }, { status: 404 });
    }

    if (payout.status !== 'APPROVED') {
      return NextResponse.json({ 
        error: 'Payout not approved',
        status: payout.status
      }, { status: 400 });
    }

    // TODO: Integrate with bank transfer API
    // For now, mark as PROCESSING then COMPLETED
    
    const now = new Date().toISOString();
    const paymentRef = `PAY-${Date.now()}`;

    const { data: executed } = await supabase
      .from('workshop_payouts')
      .update({
        status: 'COMPLETED',
        payment_method: 'BANK_TRANSFER',
        payment_reference: paymentRef,
        payment_date: now
      })
      .eq('id', payoutId)
      .select()
      .single();

    // Create finance event
    await createFinanceEvent({
      event_type: 'payout_executed',
      entity_type: 'payout',
      entity_id: payoutId,
      actor_id: user.id,
      actor_role: roleCode,
      event_data: {
        payout_id: payoutId,
        workshop_id: payout.workshop_id,
        amount: payout.net_amount_after_tax,
        payment_reference: paymentRef
      }
    });

    return NextResponse.json({
      success: true,
      payout: executed,
      message: 'Payout executed successfully'
    });

  } catch (error: any) {
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}

