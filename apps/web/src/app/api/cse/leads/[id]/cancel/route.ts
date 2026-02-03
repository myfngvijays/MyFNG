/**
 * CSE Cancel Lead API
 * POST /api/cse/leads/[id]/cancel
 * 
 * Cancel a lead (only before ACCEPTED or before job starts)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise;
  try {
    const supabase = await createClient();
    const leadId = params.id;
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify CSE role
    const { data: userProfile } = await supabase
      .from('users_login')
      .select('id, roles!inner(role_code)')
      .eq('id', user.id)
      .single();

    const roleCode = (userProfile?.roles as any)?.role_code;
    if (roleCode !== 'CUSTOMER_SERVICE_EXECUTIVE' && roleCode !== 'CSE') {
      return NextResponse.json({ error: 'Forbidden: CSE role required' }, { status: 403 });
    }

    // Get current lead status
    const { data: lead, error: leadError } = await supabase
      .from('service_leads')
      .select('id, status')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Check if cancellation is allowed
    const allowedStatuses = ['NEW', 'ASSIGNED', 'ACCEPTED', 'VEHICLE_DROPPED_AT_WORKSHOP'];
    if (!allowedStatuses.includes(lead.status)) {
      return NextResponse.json(
        { error: `Cannot cancel lead in ${lead.status} status. Cancellation only allowed before job starts.` },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { cancellation_reason } = body;

    if (!cancellation_reason) {
      return NextResponse.json({ error: 'Cancellation reason is required' }, { status: 400 });
    }

    // Update lead status
    const { data: updatedLead, error: updateError } = await supabase
      .from('service_leads')
      .update({
        status: 'CANCELLED',
        cancellation_reason: cancellation_reason,
        cancelled_at: new Date().toISOString(),
        cancelled_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', leadId)
      .select()
      .single();

    if (updateError) {
      console.error('Error cancelling lead:', updateError);
      return NextResponse.json({ error: 'Failed to cancel lead' }, { status: 500 });
    }

    // Log status history
    await supabase.from('lead_status_history').insert({
      lead_id: leadId,
      old_status: lead.status,
      new_status: 'CANCELLED',
      changed_by: user.id,
      changed_at: new Date().toISOString(),
      reason: 'Cancelled by CSE',
      notes: cancellation_reason,
    });

    // Log activity
    await supabase.from('lead_activities').insert({
      lead_id: leadId,
      user_id: user.id,
      activity_type: 'LEAD_CANCELLED',
      description: `Lead cancelled by CSE: ${cancellation_reason}`,
      metadata: { cancellation_reason },
    });

    return NextResponse.json({
      success: true,
      lead: updatedLead,
      message: 'Lead cancelled successfully',
    }, { status: 200 });

  } catch (error: any) {
    console.error('Error in CSE cancel lead API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

