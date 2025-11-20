/**
 * ================================================================
 * LEAD MANAGER - GET AVAILABLE WORKSHOPS API
 * ================================================================
 * Fetches workshops available for lead assignment based on criteria
 * ================================================================
 */

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const city = searchParams.get('city');
    const search = searchParams.get('search');

    // Build query
    let query = supabase
      .from('workshops')
      .select(`
        id,
        name,
        address,
        city,
        state,
        pincode,
        contact_person,
        phone,
        email,
        is_verified,
        audit_score,
        gst_number
      `)
      .eq('is_verified', true)
      .order('audit_score', { ascending: false, nullsFirst: false })
      .order('name');

    // Filter by city if provided
    if (city) {
      query = query.ilike('city', `%${city}%`);
    }

    // Search filter
    if (search) {
      query = query.or(`name.ilike.%${search}%,city.ilike.%${search}%,contact_person.ilike.%${search}%`);
    }

    const { data: workshops, error: workshopsError } = await query;

    if (workshopsError) {
      console.error('Workshops fetch error:', workshopsError);
      return NextResponse.json(
        { error: 'Failed to fetch workshops', details: workshopsError.message },
        { status: 500 }
      );
    }

    // Get active lead counts for each workshop
    const workshopIds = workshops?.map(w => w.id) || [];
    
    let activeLeadsCounts: any = {};
    if (workshopIds.length > 0) {
      const { data: activeCounts } = await supabase
        .from('service_leads')
        .select('workshop_id')
        .in('workshop_id', workshopIds)
        .in('status', ['ASSIGNED_TO_WORKSHOP', 'ACCEPTED', 'IN_PROGRESS', 'MECHANIC_WORKING', 'AWAITING_QC']);
      
      // Count leads per workshop
      activeCounts?.forEach((lead: any) => {
        activeLeadsCounts[lead.workshop_id] = (activeLeadsCounts[lead.workshop_id] || 0) + 1;
      });
    }

    // Enhance workshop data with active lead counts and capacity status
    const enhancedWorkshops = workshops?.map(workshop => ({
      ...workshop,
      active_leads_count: activeLeadsCounts[workshop.id] || 0,
      capacity_status: getCapacityStatus(activeLeadsCounts[workshop.id] || 0),
      rating: workshop.audit_score || 0
    })) || [];

    return NextResponse.json({
      success: true,
      workshops: enhancedWorkshops,
      total: enhancedWorkshops.length
    });

  } catch (error: any) {
    console.error('Get available workshops error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * Helper function to determine workshop capacity status
 */
function getCapacityStatus(activeLeads: number): 'AVAILABLE' | 'BUSY' | 'FULL' {
  if (activeLeads < 5) return 'AVAILABLE';
  if (activeLeads < 10) return 'BUSY';
  return 'FULL';
}

