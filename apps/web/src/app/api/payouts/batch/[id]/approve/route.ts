/**
 * Approve Payout Batch API
 * Phase 3 - Step 9: Workshop Payout Scheduling
 * Purpose: Approve payout batch for execution
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { createFinanceEvent } from '@/lib/services/financeEventService';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile
    const { data: userProfile, error: profileError } = await supabase
      .from('users_login')
      .select('id, role, name')
      .eq('email', user.email)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Verify user is Finance Manager or Super Admin
    const allowedRoles = ['super_admin', 'sub_admin', 'finance_manager'];
    if (!allowedRoles.includes(userProfile.role)) {
      return NextResponse.json({ error: 'Forbidden: Only Finance Manager can approve' }, { status: 403 });
    }

    const payoutId = params.id;
    const body = await request.json();
    const { approval_notes } = body;

    // Get payout details
    const { data: payout, error: payoutError } = await supabase
      .from('workshop_payouts')
      .select('*')
      .eq('id', payoutId)
      .single();

    if (payoutError || !payout) {
      return NextResponse.json({ error: 'Payout not found' }, { status: 404 });
    }

    if (payout.status !== 'PENDING') {
      return NextResponse.json({
        error: 'Payout cannot be approved',
        current_status: payout.status,
      }, { status: 400 });
    }

    // Check if creator and approver are different (for amounts above threshold)
    const threshold = 100000; // ₹1 lakh
    if (parseFloat(payout.amount || '0') > threshold && payout.created_by === userProfile.id) {
      return NextResponse.json({
        error: 'Payout creator cannot approve their own payout above threshold',
        threshold: threshold,
        hint: 'Another Finance Manager must approve',
      }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Update payout with approval
    const { data: updatedPayout, error: updateError } = await supabase
      .from('workshop_payouts')
      .update({
        status: 'APPROVED',
        approved_by: userProfile.id,
        approved_at: now,
        approval_notes: approval_notes || 'Payout approved by Finance Manager',
        updated_at: now,
      })
      .eq('id', payoutId)
      .select()
      .single();

    if (updateError) {
      console.error('Error approving payout:', updateError);
      return NextResponse.json({ error: 'Failed to approve payout' }, { status: 500 });
    }

    // Create finance event
    await createFinanceEvent({
      eventType: 'payout_approved',
      entityType: 'payout',
      entityId: payoutId,
      actorId: userProfile.id,
      actorRole: userProfile.role,
      actorName: userProfile.name,
      eventData: {
        payout_amount: payout.amount,
        workshop_id: payout.workshop_id,
        approved_at: now,
        approval_notes: approval_notes,
      },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({
      success: true,
      message: 'Payout approved successfully',
      payout: updatedPayout,
      next_step: 'Execute payout via bank transfer',
    }, { status: 200 });

  } catch (error) {
    console.error('Error in approve payout API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

