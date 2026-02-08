/**
 * Audit Logs API
 * GET /api/audit/logs - Fetch all audit logs with filters
 * POST /api/audit/logs - Create a new audit log entry
 */

export const dynamic = 'force-dynamic';

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { CreateAuditLogInput } from '@/shared/types/audit';

/**
 * GET /api/audit/logs
 * Fetch audit logs with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('Auth error:', authError);
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
      console.error('Audit logs profile error:', profileError);
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
    const userId = searchParams.get('user_id');
    const action = searchParams.get('action');
    const tableName = searchParams.get('table_name');
    const recordId = searchParams.get('record_id');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const actionCategory = searchParams.get('action_category');
    const severity = searchParams.get('severity');
    const apiEndpoint = searchParams.get('api_endpoint');
    const hasError = searchParams.get('has_error'); // 'true' or 'false'
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    // Build query
    let query = supabase
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    // Apply filters
    if (userId) {
      query = query.eq('user_id', userId);
    }
    if (action) {
      query = query.eq('action', action);
    }
    if (tableName) {
      query = query.eq('table_name', tableName);
    }
    if (recordId) {
      query = query.eq('record_id', recordId);
    }
    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    if (endDate) {
      query = query.lte('created_at', endDate);
    }
    if (actionCategory) {
      query = query.eq('action_category', actionCategory);
    }
    if (severity) {
      query = query.eq('severity', severity);
    }
    if (apiEndpoint) {
      query = query.ilike('api_endpoint', `%${apiEndpoint}%`);
    }
    if (hasError === 'true') {
      query = query.not('error_message', 'is', null);
    } else if (hasError === 'false') {
      query = query.is('error_message', null);
    }

    // Add pagination
    query = query.range(offset, offset + limit - 1);

    const { data: logs, error, count } = await query;

    if (error) {
      console.error('Error fetching audit logs:', error);
      return NextResponse.json(
        { error: 'Failed to fetch audit logs', details: error.message },
        { status: 500 }
      );
    }

    const total = count ?? (Array.isArray(logs) ? logs.length : 0);
    const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;

    return NextResponse.json({
      logs: Array.isArray(logs) ? logs : [],
      total,
      page,
      limit,
      totalPages,
    });
  } catch (error) {
    console.error('Error in GET /api/audit/logs:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/audit/logs
 * Create a new audit log entry
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

    const body: CreateAuditLogInput = await request.json();

    // Validate required fields
    if (!body.action) {
      return NextResponse.json(
        { error: 'Action is required' },
        { status: 400 }
      );
    }

    // Get IP address and User Agent from request headers
    const ip_address = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() 
      || request.headers.get('x-real-ip') 
      || body.ip_address 
      || null;
    
    const user_agent = request.headers.get('user-agent') || body.user_agent || null;

    // Insert audit log
    const { data: log, error } = await supabase
      .from('audit_logs')
      .insert({
        user_id: body.user_id || user.id,
        action: body.action,
        table_name: body.table_name || null,
        record_id: body.record_id || null,
        old_data: body.old_data || null,
        new_data: body.new_data || null,
        ip_address,
        user_agent,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating audit log:', error);
      return NextResponse.json(
        { error: 'Failed to create audit log' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, log },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error in POST /api/audit/logs:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

