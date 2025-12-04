/**
 * Telecaller Sub Admin Lead Correction API
 * POST /api/subadmin/telecaller/leads/[id]/correct
 * Correct lead fields (customer details, model, variant, address)
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile
    const { data: userProfile, error: profileError } = await supabase
      .from('users_login')
      .select('id, department, roles!inner(role_code)')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const roleCode = (userProfile.roles as any)?.role_code;
    const department = userProfile.department;

    if (roleCode !== 'SUB_ADMIN' || department !== 'TELECALLER') {
      return NextResponse.json({ error: 'Forbidden: Telecaller Sub Admin role required' }, { status: 403 });
    }

    const leadId = params.id;
    const body = await request.json();
    
    // Get current lead
    const { data: currentLead, error: leadError } = await supabase
      .from('service_leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (leadError || !currentLead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Build update object with only provided fields
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    // Customer details
    if (body.customer_name !== undefined) updateData.customer_name = body.customer_name;
    if (body.customer_phone !== undefined) updateData.customer_phone = body.customer_phone;
    if (body.customer_email !== undefined) updateData.customer_email = body.customer_email;
    if (body.customer_alternate_phone !== undefined) updateData.customer_alternate_phone = body.customer_alternate_phone;

    // Vehicle details
    if (body.vehicle_make !== undefined) updateData.vehicle_make = body.vehicle_make;
    if (body.vehicle_model !== undefined) updateData.vehicle_model = body.vehicle_model;
    if (body.vehicle_variant !== undefined) updateData.vehicle_variant = body.vehicle_variant;
    if (body.vehicle_year !== undefined) updateData.vehicle_year = body.vehicle_year;
    if (body.vehicle_fuel_type !== undefined) updateData.vehicle_fuel_type = body.vehicle_fuel_type;

    // Address details
    if (body.address !== undefined) updateData.address = body.address;
    if (body.city !== undefined) updateData.city = body.city;
    if (body.state !== undefined) updateData.state = body.state;
    if (body.pincode !== undefined) updateData.pincode = body.pincode;
    if (body.location_latitude !== undefined) updateData.location_latitude = body.location_latitude;
    if (body.location_longitude !== undefined) updateData.location_longitude = body.location_longitude;

    // Service details
    if (body.service_type !== undefined) updateData.service_type = body.service_type;
    if (body.service_type_ids !== undefined) updateData.service_type_ids = body.service_type_ids;
    if (body.subservice_ids !== undefined) updateData.subservice_ids = body.subservice_ids;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.problem_description !== undefined) updateData.problem_description = body.problem_description;

    // Mark as complete if was incomplete
    if (currentLead.is_incomplete && body.mark_complete !== false) {
      updateData.is_incomplete = false;
      updateData.incomplete_reason = null;
    }

    // Update lead
    const { data: updatedLead, error: updateError } = await supabase
      .from('service_leads')
      .update(updateData)
      .eq('id', leadId)
      .select()
      .single();

    if (updateError || !updatedLead) {
      console.error('Error correcting lead:', updateError);
      return NextResponse.json(
        { error: 'Failed to correct lead', details: updateError?.message },
        { status: 500 }
      );
    }

    // Log action
    await supabase.from('subadmin_actions').insert({
      subadmin_id: user.id,
      department: 'TELECALLER',
      action_type: 'CORRECT_LEAD',
      action_description: `Corrected lead ${leadId} fields`,
      related_entity_type: 'LEAD',
      related_entity_id: leadId,
      metadata: {
        corrected_fields: Object.keys(updateData).filter(k => k !== 'updated_at'),
        old_data: currentLead,
        new_data: updatedLead,
      },
    });

    // Log in lead activities
    await supabase.from('lead_activities').insert({
      lead_id: leadId,
      user_id: user.id,
      activity_type: 'LEAD_CORRECTED',
      description: `Lead corrected by Telecaller Sub Admin`,
      metadata: {
        corrected_fields: Object.keys(updateData).filter(k => k !== 'updated_at'),
      },
    });

    return NextResponse.json({
      success: true,
      lead: updatedLead,
      message: 'Lead corrected successfully',
    });

  } catch (error: any) {
    console.error('Error in POST /api/subadmin/telecaller/leads/[id]/correct:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

