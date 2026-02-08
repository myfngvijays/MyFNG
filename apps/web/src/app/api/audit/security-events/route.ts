/**
 * Security Events API
 * GET /api/audit/security-events - Fetch security events
 * POST /api/audit/security-events - Create a security event
 * PATCH /api/audit/security-events/[id] - Update event (see [id]/route.ts)
 */

export const dynamic = 'force-dynamic';

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { CreateSecurityEventInput } from '@/shared/types/audit';

/**
 * GET /api/audit/security-events
 * Fetch security events with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify user is Super Admin or Sub Admin
    const { data: userProfile, error: profileError } = await supabase
      .from('users_login')
      .select('id, role_id, roles(role_code)')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('Security events profile error:', profileError);
      return NextResponse.json(
        { error: 'Failed to verify access', details: profileError.message },
        { status: 500 }
      );
    }
    if (!userProfile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      );
    }

    const roleCode = (userProfile as any)?.roles?.role_code ?? null;
    if (!['SUPER_ADMIN', 'SUB_ADMIN'].includes(roleCode)) {
      return NextResponse.json(
        { error: 'Forbidden: Super Admin or Sub Admin access required' },
        { status: 403 }
      );
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const eventType = searchParams.get('event_type');
    const userId = searchParams.get('user_id');
    const severity = searchParams.get('severity');
    const resolved = searchParams.get('resolved'); // 'true' or 'false'
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    // Build query
    let query = supabase
      .from('security_events')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    // Apply filters
    if (eventType) {
      query = query.eq('event_type', eventType);
    }
    if (userId) {
      query = query.eq('user_id', userId);
    }
    if (severity) {
      query = query.eq('severity', severity);
    }
    if (resolved === 'true') {
      query = query.eq('resolved', true);
    } else if (resolved === 'false') {
      query = query.eq('resolved', false);
    }
    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    // Add pagination
    query = query.range(offset, offset + limit - 1);

    const { data: events, error, count } = await query;

    if (error) {
      console.error('Error fetching security events:', error);
      return NextResponse.json(
        { error: 'Failed to fetch security events', details: error.message },
        { status: 500 }
      );
    }

    const total = count ?? (Array.isArray(events) ? events.length : 0);
    const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;

    return NextResponse.json({
      events: Array.isArray(events) ? events : [],
      total,
      page,
      limit,
      totalPages,
    });
  } catch (error) {
    console.error('Error in GET /api/audit/security-events:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/audit/security-events
 * Create a new security event
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body: CreateSecurityEventInput = await request.json();

    // Validate required fields
    if (!body.event_type) {
      return NextResponse.json(
        { error: 'Event type is required' },
        { status: 400 }
      );
    }

    // Get IP address and User Agent from request headers
    const ip_address = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() 
      || request.headers.get('x-real-ip') 
      || body.ip_address 
      || null;
    
    const user_agent = request.headers.get('user-agent') || body.user_agent || null;

    // Insert security event (security_events may be missing from generated DB types)
    const { data: event, error } = await supabase
      .from('security_events')
      // @ts-expect-error - security_events table may not be in generated types
      .insert({
        event_type: body.event_type,
        user_id: body.user_id || user.id,
        ip_address,
        user_agent,
        event_details: body.event_details || {},
        severity: body.severity || 'MEDIUM',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating security event:', error);
      return NextResponse.json(
        { error: 'Failed to create security event' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, event },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error in POST /api/audit/security-events:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

