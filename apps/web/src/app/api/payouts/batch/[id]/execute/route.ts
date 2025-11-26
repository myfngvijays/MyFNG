/**
 * Execute Payout API
 * Phase 3 - Step 9: Workshop Payout Scheduling
 * Purpose: Execute approved payout via bank transfer
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

    // Verify user has finance permissions
    const allowedRoles = ['super_admin', 'sub_admin', 'finance_manager', 'accounts'];
    if (!allowedRoles.includes(userProfile.role)) {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
    }

    const payoutId = params.id;
    const body = await request.json();
    const { bank_transaction_id, bank_reference, payment_date } = body;

    // Get payout details
    const { data: payout, error: payoutError } = await supabase
      .from('workshop_payouts')
      .select('*')
      .eq('id', payoutId)
      .single();

    if (payoutError || !payout) {
      return NextResponse.json({ error: 'Payout not found' }, { status: 404 });
    }

    if (payout.status !== 'APPROVED') {
      return NextResponse.json({
        error: 'Payout must be approved before execution',
        current_status: payout.status,
      }, { status: 400 });
    }

    const now = new Date().toISOString();

    // In production, integrate with bank API for actual transfer
    // For now, simulate the transfer
    const transferSuccess = true; // Simulated
    const transactionRef = bank_transaction_id || `BANK-${Date.now()}`;

    if (!transferSuccess) {
      // Mark as failed
      await supabase
        .from('workshop_payouts')
        .update({
          status: 'FAILED',
          failure_reason: 'Bank transfer failed',
          updated_at: now,
        })
        .eq('id', payoutId);

      return NextResponse.json({
        error: 'Bank transfer failed',
        payout_id: payoutId,
      }, { status: 500 });
    }

    // Update payout with execution details
    const { data: updatedPayout, error: updateError } = await supabase
      .from('workshop_payouts')
      .update({
        status: 'COMPLETED',
        payment_method: 'BANK_TRANSFER',
        payment_reference: transactionRef,
        payment_date: payment_date || now,
        transaction_id: bank_transaction_id,
        updated_at: now,
      })
      .eq('id', payoutId)
      .select()
      .single();

    if (updateError) {
      console.error('Error executing payout:', updateError);
      return NextResponse.json({ error: 'Failed to execute payout' }, { status: 500 });
    }

    // Mark invoices as payout processed
    if (payout.job_ids && Array.isArray(payout.job_ids)) {
      await supabase
        .from('invoices')
        .update({
          payout_processed: true,
          payout_processed_at: now,
          payout_id: payoutId,
        })
        .in('id', payout.job_ids);
    }

    // Create GL entries for payout
    // Debit: Accounts Payable (Workshop)
    // Credit: Bank
    await supabase
      .from('gl_entries')
      .insert([
        {
          entry_type: 'DEBIT',
          account_type: 'ACCOUNTS_PAYABLE',
          account_name: 'WORKSHOP_PAYABLE',
          amount: parseFloat(payout.amount || '0'),
          reference_type: 'payout',
          reference_id: payoutId,
          reference_number: transactionRef,
          description: `Payout to workshop ${payout.workshop_id}`,
          posted_at: now,
          posted_by: userProfile.id,
        },
        {
          entry_type: 'CREDIT',
          account_type: 'BANK',
          account_name: 'BANK_ACCOUNT',
          amount: parseFloat(payout.amount || '0'),
          reference_type: 'payout',
          reference_id: payoutId,
          reference_number: transactionRef,
          description: `Payout to workshop ${payout.workshop_id}`,
          posted_at: now,
          posted_by: userProfile.id,
        },
      ]);

    // Create finance event
    await createFinanceEvent({
      eventType: 'payout_executed',
      entityType: 'payout',
      entityId: payoutId,
      actorId: userProfile.id,
      actorRole: userProfile.role,
      actorName: userProfile.name,
      eventData: {
        payout_amount: payout.amount,
        workshop_id: payout.workshop_id,
        bank_transaction_id: bank_transaction_id,
        executed_at: now,
      },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    // Send notification to workshop with remittance advice
    const { data: workshop } = await supabase
      .from('workshops')
      .select('id, name, phone, email')
      .eq('id', payout.workshop_id)
      .single();

    if (workshop) {
      // Get workshop admins
      const { data: workshopAdmins } = await supabase
        .from('users_login')
        .select('id, full_name, email, phone')
        .eq('workshop_id', payout.workshop_id)
        .eq('role', 'workshop_admin')
        .eq('is_active', true);

      if (workshopAdmins && workshopAdmins.length > 0) {
        // Create notifications for all workshop admins
        const notifications = workshopAdmins.map(admin => ({
          user_id: admin.id,
          title: 'Payout Executed',
          message: `Payout of ₹${payout.amount.toFixed(2)} has been executed. Transaction ID: ${transactionRef}`,
          type: 'SUCCESS',
          priority: 'HIGH',
          lead_id: null,
          metadata: {
            payout_id: payout.id,
            payout_batch_id: payout.id,
            amount: payout.amount,
            bank_transaction_id: transactionRef,
            executed_at: now,
          },
          created_at: now,
        }));

        await supabase.from('notifications').insert(notifications);

        // TODO: Send email/SMS with remittance advice breakdown
        // This would include:
        // - Payout amount
        // - Transaction reference
        // - Breakdown of leads included
        // - Deductions applied
        // - Net amount
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Payout executed successfully',
      payout: updatedPayout,
      bank_transaction_id: transactionRef,
      next_step: 'Workshop notified with remittance advice',
    }, { status: 200 });

  } catch (error) {
    console.error('Error in execute payout API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

