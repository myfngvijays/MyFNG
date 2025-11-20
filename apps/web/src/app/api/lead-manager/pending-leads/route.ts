/**
 * ================================================================
 * LEAD MANAGER - GET PENDING LEADS API
 * ================================================================
 * Fetches leads that need validation or workshop assignment
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

    // Get user details to verify role
    const { data: userData, error: userError } = await supabase
      .from('users_login')
      .select('role_id, roles(role_code)')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Verify user is Lead Manager
    const roleCode = (userData.roles as any)?.role_code;
    if (roleCode !== 'lead_manager') {
      return NextResponse.json(
        { error: 'Access denied. Only Lead Managers can view pending leads.' },
        { status: 403 }
      );
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') || 'all'; // 'new', 'validated', 'all'
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    // Build query
    let query = supabase
      .from('service_leads')
      .select(`
        *,
        created_by:users_login!created_by_id(id, full_name, email),
        city:cities(id, name, state),
        model:car_models(id, make, model_name)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Filter by status
    if (status === 'new') {
      // Leads that need validation
      query = query.in('status', ['NEW', 'INCOMPLETE']);
    } else if (status === 'validated') {
      // Leads that need workshop assignment
      query = query.eq('status', 'VALIDATED');
    } else {
      // All pending leads (NEW, INCOMPLETE, VALIDATED)
      query = query.in('status', ['NEW', 'INCOMPLETE', 'VALIDATED']);
    }

    const { data: leads, error: leadsError, count } = await query;

    if (leadsError) {
      console.error('Leads fetch error:', leadsError);
      return NextResponse.json(
        { error: 'Failed to fetch leads', details: leadsError.message },
        { status: 500 }
      );
    }

    // Get summary statistics
    const { data: stats } = await supabase
      .from('service_leads')
      .select('status', { count: 'exact', head: true })
      .in('status', ['NEW', 'INCOMPLETE', 'VALIDATED']);

    const { data: newCount } = await supabase
      .from('service_leads')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'NEW');

    const { data: incompleteCount } = await supabase
      .from('service_leads')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'INCOMPLETE');

    const { data: validatedCount } = await supabase
      .from('service_leads')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'VALIDATED');

    return NextResponse.json({
      success: true,
      leads: leads || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      },
      summary: {
        total_pending: count || 0,
        new_leads: newCount?.length || 0,
        incomplete_leads: incompleteCount?.length || 0,
        validated_leads: validatedCount?.length || 0
      }
    });

  } catch (error: any) {
    console.error('Get pending leads error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

