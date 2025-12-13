import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * GET /api/pickup/dashboard
 * Get pickup boy dashboard data
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Get user profile
    const { data: userProfile, error: profileError } = await supabase
      .from('users_login')
      .select('*, role:roles(*)')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Check if user is pickup boy
    if (userProfile.role.role_code !== 'WORKSHOP_PICKUP_BOY') {
      return NextResponse.json({ error: 'Unauthorized - Not a pickup boy' }, { status: 403 });
    }

    // Get today's date range
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // Get today's pickups (in-progress)
    const { data: todayPickups, error: pickupsError } = await supabase
      .from('pickup_tracking')
      .select(`
        *,
        lead:service_leads(*)
      `)
      .eq('pickup_assigned_to', user.id)
      .gte('pickup_assigned_at', todayStart.toISOString())
      .lte('pickup_assigned_at', todayEnd.toISOString())
      .in('pickup_status', ['PENDING', 'ON_THE_WAY', 'ARRIVED', 'OTP_VERIFIED', 'PICKED', 'VEHICLE_IN_TRANSIT', 'ARRIVED_AT_WORKSHOP'])
      .order('pickup_assigned_at', { ascending: true });

    // Get today's drops (in-progress)
    const { data: todayDrops, error: dropsError } = await supabase
      .from('pickup_tracking')
      .select(`
        *,
        lead:service_leads(*)
      `)
      .eq('drop_assigned_to', user.id)
      .gte('drop_assigned_at', todayStart.toISOString())
      .lte('drop_assigned_at', todayEnd.toISOString())
      .in('drop_status', ['PENDING', 'ASSIGNED', 'OUT_FOR_DELIVERY', 'IN_TRANSIT', 'ARRIVED_AT_CUSTOMER'])
      .order('drop_assigned_at', { ascending: true });

    // Get pending OTP verifications (either pickup OTP pending, or delivery arrived-at-customer awaiting DROP OTP)
    const { data: pendingOTP, error: otpError } = await supabase
      .from('pickup_tracking')
      .select(`
        *,
        lead:service_leads(*)
      `)
      .or(`pickup_assigned_to.eq.${user.id},drop_assigned_to.eq.${user.id}`)
      .or('pickup_status.eq.PENDING,drop_status.eq.ARRIVED_AT_CUSTOMER')
      .order('created_at', { ascending: true });

    // Get completed pickups (today)
    const { data: completedPickups, error: completedPickupsError } = await supabase
      .from('pickup_tracking')
      .select(`
        *,
        lead:service_leads(*)
      `)
      .eq('pickup_assigned_to', user.id)
      .gte('pickup_arrival_time', todayStart.toISOString())
      .lte('pickup_arrival_time', todayEnd.toISOString())
      .in('pickup_status', ['ARRIVED_AT_WORKSHOP', 'DROPPED'])
      .order('pickup_arrival_time', { ascending: false });

    // Get completed drops (today)
    const { data: completedDrops, error: completedDropsError } = await supabase
      .from('pickup_tracking')
      .select(`
        *,
        lead:service_leads(*)
      `)
      .eq('drop_assigned_to', user.id)
      .gte('drop_completed_time', todayStart.toISOString())
      .lte('drop_completed_time', todayEnd.toISOString())
      .eq('drop_status', 'DELIVERED')
      .order('drop_completed_time', { ascending: false });

    // Get today's metrics
    const { data: metrics, error: metricsError } = await supabase
      .from('pickup_boy_metrics')
      .select('*')
      .eq('pickup_boy_id', user.id)
      .eq('date', todayStart.toISOString().split('T')[0])
      .single();

    // Calculate total distance
    const totalDistance = metrics?.distance_traveled || 0;

    return NextResponse.json({
      success: true,
      data: {
        today_pickups: todayPickups || [],
        today_drops: todayDrops || [],
        pending_otp: pendingOTP || [],
        completed_pickups: completedPickups || [],
        completed_drops: completedDrops || [],
        total_distance: totalDistance,
        metrics: metrics || null,
      },
    });
  } catch (error: any) {
    console.error('Error fetching pickup boy dashboard:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

