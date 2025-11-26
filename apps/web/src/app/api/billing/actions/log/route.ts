/**
 * Log Billing Team Action API
 * Purpose: Track all billing team actions for audit trail
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
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
      .select('id, role')
      .eq('email', user.email)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Verify user is billing team
    const allowedRoles = ['billing', 'super_admin', 'sub_admin', 'finance_manager'];
    if (!allowedRoles.includes(userProfile.role)) {
      return NextResponse.json({ error: 'Forbidden: Billing team only' }, { status: 403 });
    }

    const body = await request.json();
    const {
      lead_id,
      invoice_id,
      action_type, // INVOICE_GENERATED, INVOICE_REVISED, INVOICE_SENT, PAYMENT_RECORDED, etc.
      action_description,
      previous_amount,
      new_amount,
      revision_reason,
      invoice_sent_via,
      recipient_phone,
      recipient_email,
      payment_link,
      notes,
      metadata,
    } = body;

    if (!lead_id || !action_type) {
      return NextResponse.json({
        error: 'Missing required fields: lead_id, action_type',
      }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Create billing action record
    const { data: action, error: actionError } = await supabase
      .from('billing_team_actions')
      .insert({
        lead_id: lead_id,
        invoice_id: invoice_id,
        billing_member_id: userProfile.id,
        action_type: action_type,
        action_description: action_description,
        previous_amount: previous_amount,
        new_amount: new_amount,
        revision_reason: revision_reason,
        invoice_sent_via: invoice_sent_via,
        recipient_phone: recipient_phone,
        recipient_email: recipient_email,
        payment_link: payment_link,
        notes: notes,
        metadata: metadata || {},
        created_at: now,
      })
      .select()
      .single();

    if (actionError) {
      console.error('Error logging billing action:', actionError);
      return NextResponse.json({ error: 'Failed to log action' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Billing action logged successfully',
      action: action,
    }, { status: 201 });

  } catch (error) {
    console.error('Error in log billing action API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

