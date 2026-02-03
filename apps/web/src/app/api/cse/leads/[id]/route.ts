/**
 * CSE Lead Detail API
 * GET /api/cse/leads/[id]
 * 
 * Fetch comprehensive lead details for CSE
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(
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

    // Fetch comprehensive lead details
    const { data: lead, error: leadError } = await supabase
      .from('service_leads')
      .select(`
        *,
        pickup_tracking:pickup_tracking!pickup_tracking_lead_id_fkey(
          pickup_required,
          drop_required,
          pickup_status,
          pickup_time_slot,
          pickup_time_window_start,
          pickup_time_window_end,
          pickup_address,
          drop_status,
          drop_time_slot,
          drop_assigned_at,
          drop_start_time,
          drop_address
        ),
        workshop:workshops!workshop_id(
          id,
          name,
          phone,
          city,
          address,
          email
        ),
        assigned_mechanic:users_login!assigned_mechanic_id(
          id,
          full_name,
          phone
        ),
        assigned_supervisor:users_login!assigned_supervisor_id(
          id,
          full_name,
          phone
        ),
        assigned_pickup_boy:users_login!assigned_pickup_boy_id(
          id,
          full_name,
          phone
        ),
        invoice:invoices!service_leads_invoice_id_fkey(
          id,
          invoice_number,
          base_amount,
          parts_cost,
          extra_charges_amount,
          total_tax,
          final_amount,
          status
        ),
        extra_charges:lead_extra_charges(
          id,
          description,
          amount,
          reason,
          status
        )
      `)
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Parse service types and addons if they're JSON strings
    let serviceTypeIds = lead.service_type_ids;
    if (typeof serviceTypeIds === 'string') {
      try {
        serviceTypeIds = JSON.parse(serviceTypeIds);
      } catch (e) {
        serviceTypeIds = [];
      }
    }

    let subserviceIds = lead.subservice_ids;
    if (typeof subserviceIds === 'string') {
      try {
        subserviceIds = JSON.parse(subserviceIds);
      } catch (e) {
        subserviceIds = [];
      }
    }

    // Fetch service type names
    if (serviceTypeIds && Array.isArray(serviceTypeIds) && serviceTypeIds.length > 0) {
      const { data: serviceTypes } = await supabase
        .from('service_types')
        .select('id, name')
        .in('id', serviceTypeIds);
      if (serviceTypes) {
        lead.service_type_names = serviceTypes.map((st: any) => st.name);
      }
    }

    // Fetch service addon details
    if (subserviceIds && Array.isArray(subserviceIds) && subserviceIds.length > 0) {
      const { data: serviceAddons } = await supabase
        .from('service_addons')
        .select('id, name, price')
        .in('id', subserviceIds);
      if (serviceAddons) {
        lead.service_addon_details = serviceAddons;
      }
    }

    return NextResponse.json({
      success: true,
      lead,
    }, { status: 200 });

  } catch (error: any) {
    console.error('Error in CSE lead detail API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

