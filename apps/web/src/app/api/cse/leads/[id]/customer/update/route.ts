/**
 * CSE Update Customer Details API
 * POST /api/cse/leads/[id]/customer/update
 * 
 * Update customer details (name, phone, email, address, communication preference)
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

    const body = await request.json();
    const {
      customer_name,
      customer_phone,
      customer_email,
      customer_address,
      communication_preference,
    } = body;

    // Build update object
    const updates: any = {
      updated_at: new Date().toISOString(),
    };

    if (customer_name !== undefined) updates.customer_name = customer_name;
    if (customer_phone !== undefined) updates.customer_phone = customer_phone;
    if (customer_email !== undefined) updates.customer_email = customer_email;
    if (customer_address !== undefined) updates.customer_address = customer_address;
    if (communication_preference !== undefined) updates.communication_preference = communication_preference;

    // Update lead
    const { data: updatedLead, error: updateError } = await supabase
      .from('service_leads')
      .update(updates)
      .eq('id', leadId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating customer details:', updateError);
      return NextResponse.json({ error: 'Failed to update customer details' }, { status: 500 });
    }

    // Log activity
    await supabase.from('lead_activities').insert({
      lead_id: leadId,
      user_id: user.id,
      activity_type: 'CUSTOMER_DETAILS_UPDATED',
      description: 'Customer details updated by CSE',
      metadata: { updates },
    });

    return NextResponse.json({
      success: true,
      lead: updatedLead,
    }, { status: 200 });

  } catch (error: any) {
    console.error('Error in CSE update customer API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

