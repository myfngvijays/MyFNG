import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/supervisor/jobs
 * 
 * Fetch jobs list for supervisor with filters
 * 
 * Query params:
 * - status: Filter by status (NEW, ASSIGNED, IN_PROGRESS, etc.)
 * - mechanic_id: Filter by assigned mechanic
 * - service_type: Filter by service type
 * - sla_status: Filter by SLA status (ON_TIME, AT_RISK, BREACHED)
 * - search: Search by lead number, customer name, or vehicle number
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20, max: 100)
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile to verify supervisor role and workshop
    const { data: userProfile, error: profileError } = await supabase
      .from('users_login')
      .select('role_id, workshop_id, roles!inner(role_code)')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Verify supervisor role
    const roleCode = (userProfile.roles as any)?.role_code;
    if (roleCode !== 'WORKSHOP_SUPERVISOR') {
      return NextResponse.json({ error: 'Forbidden: Supervisor role required' }, { status: 403 });
    }

    const workshopId = userProfile.workshop_id;
    if (!workshopId) {
      return NextResponse.json({ error: 'No workshop assigned' }, { status: 400 });
    }

    // Parse query parameters
    const status = searchParams.get('status');
    const mechanicId = searchParams.get('mechanic_id');
    const serviceType = searchParams.get('service_type');
    const slaStatus = searchParams.get('sla_status');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const offset = (page - 1) * limit;

    console.log('Supervisor jobs API - Filters:', { status, mechanicId, serviceType, slaStatus, search, page });

    // Build query
    let query = supabase
      .from('service_leads')
      .select(`
        id,
        lead_number,
        customer_name,
        customer_phone,
        vehicle_number,
        vehicle_make,
        vehicle_model,
        vehicle_variant,
        service_type,
        service_type_ids,
        status,
        priority,
        sla_status,
        sla_accept_deadline,
        sla_start_deadline,
        pickup_required,
        pickup_status,
        assigned_pickup_boy_id,
        created_at,
        updated_at,
        assigned_mechanic_id,
        qc_status,
        mechanic:assigned_mechanic_id(id, full_name, profile_image),
        pickup_boy:assigned_pickup_boy_id(id, full_name, profile_image),
        extra_charges:lead_extra_charges(id, status),
        media:mechanic_media(id, media_category),
        mechanic_jobs:mechanic_jobs(mechanic_status, started_at, completed_at)
      `, { count: 'exact' })
      .eq('workshop_id', workshopId)
      .not('status', 'in', '(REJECTED,CANCELLED)');

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }

    if (mechanicId) {
      query = query.eq('assigned_mechanic_id', mechanicId);
    }

    if (serviceType) {
      query = query.ilike('service_type', `%${serviceType}%`);
    }

    if (slaStatus) {
      query = query.eq('sla_status', slaStatus);
    }

    if (search) {
      query = query.or(`lead_number.ilike.%${search}%,customer_name.ilike.%${search}%,vehicle_number.ilike.%${search}%`);
    }

    // Sort and paginate
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: jobs, error: jobsError, count } = await query;

    if (jobsError) {
      console.error('Jobs fetch error:', jobsError);
      return NextResponse.json(
        { error: 'Failed to fetch jobs', details: jobsError.message },
        { status: 500 }
      );
    }

    // Transform data to include computed fields
    const transformedJobs = await Promise.all((jobs || []).map(async (job: any) => {
      // Calculate SLA time remaining
      let timeRemaining = null;
      let slaDeadline = null;

      if (job.status === 'ASSIGNED' && job.sla_accept_deadline) {
        slaDeadline = new Date(job.sla_accept_deadline);
      } else if (job.status === 'ACCEPTED' && job.sla_start_deadline) {
        slaDeadline = new Date(job.sla_start_deadline);
      }

      if (slaDeadline) {
        const now = new Date();
        const diff = slaDeadline.getTime() - now.getTime();
        const minutes = Math.floor(diff / 60000);
        
        if (minutes > 60) {
          timeRemaining = `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
        } else if (minutes > 0) {
          timeRemaining = `${minutes}m`;
        } else {
          timeRemaining = 'Overdue';
        }
      }

      // Check image status from mechanic_media table
      const mediaByCategory = (job.media || []).reduce((acc: any, m: any) => {
        acc[m.media_category] = true;
        return acc;
      }, {});

      const images = {
        before: mediaByCategory['BEFORE'] || false,
        progress: mediaByCategory['PROGRESS'] || false,
        after: mediaByCategory['AFTER'] || false
      };

      // Check for pending extra work
      const extraWorkPending = (job.extra_charges || []).some((ec: any) => ec.status === 'PENDING');

      // Get mechanic_status from mechanic_jobs (if exists)
      const mechanicJob = Array.isArray(job.mechanic_jobs) && job.mechanic_jobs.length > 0 
        ? job.mechanic_jobs[0] 
        : null;
      const mechanicStatus = mechanicJob?.mechanic_status || null;

      // Determine display status: prioritize mechanic_status over lead status
      let displayStatus = job.status;
      if (mechanicStatus === 'IN_PROGRESS' && job.status !== 'IN_PROGRESS') {
        displayStatus = 'IN_PROGRESS';
      } else if (mechanicStatus === 'COMPLETED' && job.status === 'WORK_COMPLETED') {
        // If mechanic completed, show WORK_COMPLETED status (not COMPLETED)
        displayStatus = 'WORK_COMPLETED';
      }

      // Mask phone number (show only last 4 digits)
      const maskedPhone = job.customer_phone 
        ? `xxxxxx${job.customer_phone.slice(-4)}` 
        : null;

      // Parse service types from JSONB array and fetch names
      let serviceTypeDisplay = job.service_type || 'General Service';
      let serviceTypeNames: string[] = [];
      
      // Parse service_type_ids if it's a string (JSONB from Supabase)
      let serviceTypeIds = job.service_type_ids;
      if (typeof serviceTypeIds === 'string') {
        try {
          serviceTypeIds = JSON.parse(serviceTypeIds);
        } catch (e) {
          console.error('Failed to parse service_type_ids:', e);
        }
      }
      
      if (serviceTypeIds && Array.isArray(serviceTypeIds) && serviceTypeIds.length > 0) {
        // Fetch service type names from database
        const { data: serviceTypes } = await supabase
          .from('service_types')
          .select('id, name')
          .in('id', serviceTypeIds);
        
        if (serviceTypes && serviceTypes.length > 0) {
          serviceTypeNames = serviceTypes.map((st: any) => st.name);
          
          if (serviceTypeNames.length === 1) {
            serviceTypeDisplay = serviceTypeNames[0];
          } else {
            serviceTypeDisplay = serviceTypeNames.join(', ');
          }
        }
      }

      return {
        id: job.id,
        lead_number: job.lead_number,
        customer_name: job.customer_name,
        customer_phone_masked: maskedPhone,
        vehicle_number: job.vehicle_number,
        vehicle_make: job.vehicle_make,
        vehicle_model: job.vehicle_model,
        vehicle_variant: job.vehicle_variant,
        service_type: serviceTypeDisplay,
        service_type_names: serviceTypeNames,
        service_type_ids: job.service_type_ids,
        status: displayStatus, // Use display status instead of raw status
        priority: job.priority,
        sla_status: job.sla_status,
        time_remaining: timeRemaining,
        pickup_required: job.pickup_required,
        pickup_status: job.pickup_status,
        qc_status: job.qc_status,
        mechanic: job.mechanic ? {
          id: job.mechanic.id,
          name: job.mechanic.full_name,
          profileImage: job.mechanic.profile_image
        } : null,
        pickup_boy: job.pickup_boy ? {
          id: job.pickup_boy.id,
          name: job.pickup_boy.full_name,
          profileImage: job.pickup_boy.profile_image
        } : null,
        images,
        extra_work_pending: extraWorkPending,
        created_at: job.created_at,
        updated_at: job.updated_at
      };
    }));

    return NextResponse.json({
      success: true,
      data: {
        jobs: transformedJobs,
        pagination: {
          total: count || 0,
          page,
          limit,
          totalPages: count ? Math.ceil(count / limit) : 0
        }
      }
    });

  } catch (error: any) {
    console.error('Supervisor jobs API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch jobs', details: error.message },
      { status: 500 }
    );
  }
}

