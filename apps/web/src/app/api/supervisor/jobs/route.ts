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

    // Build optimized query - fetch only essential data first
    // Avoid nested queries which are slow - we'll fetch related data separately
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
        qc_status
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

    if (!jobs || jobs.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          jobs: [],
          pagination: {
            total: count || 0,
            page,
            limit,
            totalPages: count ? Math.ceil(count / limit) : 0
          }
        }
      });
    }

    // Fetch related data in parallel (much faster than nested queries)
    const leadIds = jobs.map((j: any) => j.id);
    const mechanicIds = [...new Set(jobs.map((j: any) => j.assigned_mechanic_id).filter(Boolean))];
    const pickupBoyIds = [...new Set(jobs.map((j: any) => j.assigned_pickup_boy_id).filter(Boolean))];

    // Parallel fetch all related data
    const [
      { data: mechanicJobsData },
      { data: mechanicsData },
      { data: pickupBoysData },
      { data: extraChargesData },
      { data: mediaData }
    ] = await Promise.all([
      // Mechanic jobs
      supabase
        .from('mechanic_jobs')
        .select('lead_id, mechanic_status, started_at, completed_at')
        .in('lead_id', leadIds),
      // Mechanics
      mechanicIds.length > 0 ? supabase
        .from('users_login')
        .select('id, full_name, profile_image')
        .in('id', mechanicIds) : Promise.resolve({ data: [] }),
      // Pickup boys
      pickupBoyIds.length > 0 ? supabase
        .from('users_login')
        .select('id, full_name, profile_image')
        .in('id', pickupBoyIds) : Promise.resolve({ data: [] }),
      // Extra charges
      supabase
        .from('lead_extra_charges')
        .select('lead_id, status')
        .in('lead_id', leadIds),
      // Media
      supabase
        .from('mechanic_media')
        .select('lead_id, media_category')
        .in('lead_id', leadIds)
    ]);

    // Create lookup maps for O(1) access
    const mechanicJobsMap = new Map();
    (mechanicJobsData || []).forEach((mj: any) => {
      mechanicJobsMap.set(mj.lead_id, mj);
    });

    const mechanicsMap = new Map();
    (mechanicsData || []).forEach((m: any) => {
      mechanicsMap.set(m.id, m);
    });

    const pickupBoysMap = new Map();
    (pickupBoysData || []).forEach((pb: any) => {
      pickupBoysMap.set(pb.id, pb);
    });

    const extraChargesMap = new Map();
    (extraChargesData || []).forEach((ec: any) => {
      if (!extraChargesMap.has(ec.lead_id)) {
        extraChargesMap.set(ec.lead_id, []);
      }
      extraChargesMap.get(ec.lead_id).push(ec);
    });

    const mediaMap = new Map();
    (mediaData || []).forEach((m: any) => {
      if (!mediaMap.has(m.lead_id)) {
        mediaMap.set(m.lead_id, []);
      }
      mediaMap.get(m.lead_id).push(m);
    });

    // Collect all unique service_type_ids for batch fetching
    const allServiceTypeIds = new Set<string>();
    jobs.forEach((job: any) => {
      let serviceTypeIds = job.service_type_ids;
      if (typeof serviceTypeIds === 'string') {
        try {
          serviceTypeIds = JSON.parse(serviceTypeIds);
        } catch (e) {
          // Ignore parse errors
        }
      }
      if (Array.isArray(serviceTypeIds)) {
        serviceTypeIds.forEach((id: string) => allServiceTypeIds.add(id));
      }
    });

    // Batch fetch all service types at once (single query instead of N queries)
    const serviceTypesMap = new Map();
    if (allServiceTypeIds.size > 0) {
      const { data: serviceTypes } = await supabase
        .from('service_types')
        .select('id, name')
        .in('id', Array.from(allServiceTypeIds));
      
      if (serviceTypes) {
        serviceTypes.forEach((st: any) => {
          serviceTypesMap.set(st.id, st.name);
        });
      }
    }

    // Transform data synchronously (no async operations in map)
    const transformedJobs = (jobs || []).map((job: any) => {
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

      // Check image status from pre-fetched media map
      const jobMedia = mediaMap.get(job.id) || [];
      const mediaByCategory = jobMedia.reduce((acc: any, m: any) => {
        acc[m.media_category] = true;
        return acc;
      }, {});

      const images = {
        before: mediaByCategory['BEFORE'] || false,
        progress: mediaByCategory['PROGRESS'] || false,
        after: mediaByCategory['AFTER'] || false
      };

      // Check for pending extra work from pre-fetched map
      const jobExtraCharges = extraChargesMap.get(job.id) || [];
      const extraWorkPending = jobExtraCharges.some((ec: any) => ec.status === 'PENDING');

      // Get mechanic_status from pre-fetched map
      const mechanicJob = mechanicJobsMap.get(job.id) || null;
      const mechanicStatus = mechanicJob?.mechanic_status || null;

      // Determine display status: prioritize mechanic_status over lead status
      // IMPORTANT: Check COMPLETED FIRST before IN_PROGRESS to prevent override
      let displayStatus = job.status;
      
      // Priority 1: If mechanic put job on HOLD, show HOLD/ON_HOLD
      if (mechanicStatus === 'HOLD' || mechanicStatus === 'ON_HOLD') {
        displayStatus = 'HOLD'; // Use HOLD for display consistency
        // Debug log for HOLD status
        if (job.lead_number === 'L-80741031') {
          console.log('🔍 API: Found HOLD for', job.lead_number, {
            mechanicStatus,
            jobStatus: job.status,
            displayStatus
          });
        }
      }
      // Priority 2: If mechanic completed, show COMPLETED (unless QC approved)
      else if (mechanicStatus === 'COMPLETED') {
        // If mechanic completed, check QC status
        if (job.qc_status === 'PASSED' || job.status === 'READY_FOR_BILLING' || job.status === 'QC_APPROVED') {
          // QC already approved - show READY_FOR_BILLING or QC_APPROVED
          displayStatus = job.status === 'READY_FOR_BILLING' ? 'READY_FOR_BILLING' : (job.status === 'QC_APPROVED' ? 'QC_APPROVED' : 'READY_FOR_BILLING');
        } else {
          // Mechanic completed but QC not approved yet - ALWAYS show COMPLETED
          // Override ANY status (IN_PROGRESS, ACCEPTED, VEHICLE_DROPPED_AT_WORKSHOP, etc.)
          displayStatus = 'COMPLETED';
        }
      } 
      // Priority 3: If mechanic is working (but not completed), show IN_PROGRESS
      else if (mechanicStatus === 'IN_PROGRESS' && job.status !== 'IN_PROGRESS') {
        // Only show IN_PROGRESS if mechanic is working AND hasn't completed yet
        displayStatus = 'IN_PROGRESS';
      } 
      // Priority 4: If status is READY_FOR_BILLING but mechanic hasn't completed, keep it
      else if (job.status === 'READY_FOR_BILLING' && (!mechanicStatus || mechanicStatus !== 'COMPLETED')) {
        displayStatus = 'READY_FOR_BILLING';
      }

      // Mask phone number (show only last 4 digits)
      const maskedPhone = job.customer_phone 
        ? `xxxxxx${job.customer_phone.slice(-4)}` 
        : null;

      // Parse service types from JSONB array using pre-fetched map
      let serviceTypeDisplay = job.service_type || 'General Service';
      let serviceTypeNames: string[] = [];
      
      // Parse service_type_ids if it's a string (JSONB from Supabase)
      let serviceTypeIds = job.service_type_ids;
      if (typeof serviceTypeIds === 'string') {
        try {
          serviceTypeIds = JSON.parse(serviceTypeIds);
        } catch (e) {
          // Ignore parse errors
        }
      }
      
      if (serviceTypeIds && Array.isArray(serviceTypeIds) && serviceTypeIds.length > 0) {
        // Use pre-fetched service types map (no database query here)
        serviceTypeNames = serviceTypeIds
          .map((id: string) => serviceTypesMap.get(id))
          .filter((name: string | undefined) => name !== undefined);
        
        if (serviceTypeNames.length > 0) {
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
        mechanic: job.assigned_mechanic_id ? (mechanicsMap.get(job.assigned_mechanic_id) ? {
          id: mechanicsMap.get(job.assigned_mechanic_id).id,
          name: mechanicsMap.get(job.assigned_mechanic_id).full_name,
          profileImage: mechanicsMap.get(job.assigned_mechanic_id).profile_image
        } : null) : null,
        pickup_boy: job.assigned_pickup_boy_id ? (pickupBoysMap.get(job.assigned_pickup_boy_id) ? {
          id: pickupBoysMap.get(job.assigned_pickup_boy_id).id,
          name: pickupBoysMap.get(job.assigned_pickup_boy_id).full_name,
          profileImage: pickupBoysMap.get(job.assigned_pickup_boy_id).profile_image
        } : null) : null,
        images,
        extra_work_pending: extraWorkPending,
        created_at: job.created_at,
        updated_at: job.updated_at
      };
    });

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

