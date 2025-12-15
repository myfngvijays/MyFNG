import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// POST - Generate checklist for a job if it doesn't exist
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

    // Get user profile (users_login is mapped by email/phone; not always same as auth user.id)
    const email = (user.email || '').trim();
    const phone = (user.phone || '').trim();
    const selectProfile = 'id, email, phone, roles!inner(role_code)';

    const { data: userProfileByEmail, error: profileErrorByEmail } = email
      ? await supabase.from('users_login').select(selectProfile).ilike('email', email).maybeSingle()
      : { data: null, error: null };

    const { data: userProfileByPhone, error: profileErrorByPhone } = !userProfileByEmail && phone
      ? await supabase.from('users_login').select(selectProfile).eq('phone', phone).maybeSingle()
      : { data: null, error: null };

    const { data: userProfileById, error: profileErrorById } = !userProfileByEmail && !userProfileByPhone
      ? await supabase.from('users_login').select(selectProfile).eq('id', user.id).maybeSingle()
      : { data: null, error: null };

    const userProfile = userProfileByEmail || userProfileByPhone || userProfileById;

    if (!userProfile) {
      return NextResponse.json(
        {
          error: 'User profile not found',
          user_email: email || null,
          user_phone: phone || null,
          profile_lookup_errors: [profileErrorByEmail?.message, profileErrorByPhone?.message, profileErrorById?.message].filter(Boolean),
        },
        { status: 404 }
      );
    }

    // Verify user is mechanic
    const roleCode = (userProfile.roles as any)?.role_code;
    if (roleCode !== 'WORKSHOP_MECHANIC') {
      return NextResponse.json({ error: 'Forbidden: Mechanic only' }, { status: 403 });
    }

    const leadId = params.id;

    // Get lead details
    const { data: lead, error: leadError } = await supabase
      .from('service_leads')
      .select('service_type_ids, service_type, lead_number')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      console.error('Error fetching lead:', leadError);
      return NextResponse.json({ 
        error: 'Lead not found',
        details: leadError?.message 
      }, { status: 404 });
    }

    console.log('Lead data for checklist generation:', {
      lead_id: leadId,
      lead_number: lead.lead_number,
      service_type_ids: lead.service_type_ids,
      service_type: lead.service_type
    });

    // Get mechanic job
    const { data: job, error: jobError } = await supabase
      .from('mechanic_jobs')
      .select('mechanic_id')
      .eq('lead_id', leadId)
      .eq('mechanic_id', userProfile.id)
      .single();

    if (jobError || !job) {
      return NextResponse.json({ error: 'Job not found or not assigned to you' }, { status: 404 });
    }

    // Check if checklist already exists
    const { data: existingChecklist } = await supabase
      .from('service_checklists')
      .select('id, checklist_items')
      .eq('lead_id', leadId)
      .eq('mechanic_id', userProfile.id)
      .maybeSingle();

    if (existingChecklist) {
      // Check if checklist has items
      const items = existingChecklist.checklist_items;
      if (items && (Array.isArray(items) ? items.length > 0 : JSON.parse(items).length > 0)) {
        return NextResponse.json({ 
          success: true,
          message: 'Checklist already exists',
          checklist: existingChecklist
        }, { status: 200 });
      }
    }

    // Get service type name
    let serviceTypeName = '';
    
    // Parse service_type_ids if it's a string (JSONB from Supabase)
    let serviceTypeIds = lead.service_type_ids;
    if (typeof serviceTypeIds === 'string') {
      try {
        serviceTypeIds = JSON.parse(serviceTypeIds);
      } catch (e) {
        console.error('Failed to parse service_type_ids:', e);
        serviceTypeIds = null;
      }
    }
    
    if (serviceTypeIds && Array.isArray(serviceTypeIds) && serviceTypeIds.length > 0) {
      console.log('Fetching service type for ID:', serviceTypeIds[0]);
      const { data: serviceType, error: serviceTypeError } = await supabase
        .from('service_types')
        .select('id, name')
        .eq('id', serviceTypeIds[0])
        .single();
      
      if (serviceTypeError) {
        console.error('Error fetching service type:', serviceTypeError);
      }
      
      if (serviceType?.name) {
        serviceTypeName = serviceType.name;
        console.log('Found service type name:', serviceTypeName);
      } else {
        console.log('Service type not found for ID:', serviceTypeIds[0]);
      }
    }
    
    // Fallback to legacy service_type column
    if (!serviceTypeName && lead.service_type) {
      serviceTypeName = lead.service_type;
      console.log('Using legacy service_type:', serviceTypeName);
    }

    if (!serviceTypeName) {
      console.error('No service type found for lead:', {
        lead_id: leadId,
        service_type_ids: lead.service_type_ids,
        service_type: lead.service_type
      });
      return NextResponse.json({ 
        error: 'Service type not found for this lead',
        details: 'Please ensure the lead has a service type assigned',
        lead_data: {
          service_type_ids: lead.service_type_ids,
          service_type: lead.service_type
        }
      }, { status: 400 });
    }

    // Call database function to generate checklist
    const { data: checklistId, error: generateError } = await supabase.rpc(
      'generate_service_checklist',
      {
        p_lead_id: leadId,
        p_mechanic_id: userProfile.id,
        p_service_type: serviceTypeName
      }
    );

    if (generateError) {
      console.error('Error generating checklist:', generateError);
      return NextResponse.json({ 
        error: 'Failed to generate checklist',
        details: generateError.message
      }, { status: 500 });
    }

    // Fetch the newly created checklist
    const { data: newChecklist, error: fetchError } = await supabase
      .from('service_checklists')
      .select('*')
      .eq('id', checklistId)
      .single();

    if (fetchError || !newChecklist) {
      return NextResponse.json({ 
        error: 'Checklist generated but could not be fetched',
        checklist_id: checklistId
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Checklist generated successfully',
      checklist: newChecklist
    }, { status: 201 });

  } catch (error) {
    console.error('Error in generate checklist API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

