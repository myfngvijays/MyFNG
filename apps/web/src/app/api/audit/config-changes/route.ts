/**
 * System Config Changes API
 * GET /api/audit/config-changes - Fetch configuration changes
 * POST /api/audit/config-changes - Log a configuration change
 */

export const dynamic = 'force-dynamic';

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { CreateSystemConfigChangeInput } from '@/shared/types/audit';
import { logAudit } from '@/lib/audit/logger';
import { getIpAddress, getUserAgent } from '@/lib/audit/logger';

/**
 * GET /api/audit/config-changes
 * Fetch configuration changes with optional filters
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

    // Verify user is Super Admin
    const { data: userProfile, error: profileError } = await supabase
      .from('users_login')
      .select('id, roles!inner(role_code)')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      );
    }

    const roleCode = (userProfile.roles as any)?.role_code;
    if (roleCode !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: Super Admin access required' },
        { status: 403 }
      );
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const configKey = searchParams.get('config_key');
    const changedBy = searchParams.get('changed_by');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    // Build query
    let query = supabase
      .from('system_config_changes')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    // Apply filters
    if (configKey) {
      query = query.eq('config_key', configKey);
    }
    if (changedBy) {
      query = query.eq('changed_by', changedBy);
    }
    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    // Add pagination
    query = query.range(offset, offset + limit - 1);

    const { data: changes, error, count } = await query;

    if (error) {
      console.error('Error fetching config changes:', error);
      return NextResponse.json(
        { error: 'Failed to fetch config changes' },
        { status: 500 }
      );
    }

    const totalPages = count ? Math.ceil(count / limit) : 0;

    return NextResponse.json({
      changes: changes || [],
      total: count || 0,
      page,
      limit,
      totalPages,
    });
  } catch (error) {
    console.error('Error in GET /api/audit/config-changes:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/audit/config-changes
 * Log a configuration change
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

    const body: CreateSystemConfigChangeInput = await request.json();

    // Validate required fields
    if (!body.config_key) {
      return NextResponse.json(
        { error: 'Config key is required' },
        { status: 400 }
      );
    }

    // Get IP address and User Agent from request headers
    const ip_address = getIpAddress(request.headers);
    const user_agent = getUserAgent(request.headers);

    // Insert config change
    const { data: change, error } = await supabase
      .from('system_config_changes')
      .insert({
        config_key: body.config_key,
        old_value: body.old_value || null,
        new_value: body.new_value || null,
        changed_by: body.changed_by || user.id,
        change_reason: body.change_reason || null,
        approved_by: body.approved_by || null,
        ip_address,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating config change:', error);
      return NextResponse.json(
        { error: 'Failed to create config change' },
        { status: 500 }
      );
    }

    // Also log as audit event
    await logAudit({
      user_id: body.changed_by || user.id,
      action: 'SETTINGS_CHANGE',
      table_name: 'system_settings',
      record_id: null,
      old_data: { [body.config_key]: body.old_value },
      new_data: { [body.config_key]: body.new_value },
      ip_address,
      user_agent,
      action_category: 'CONFIG',
      severity: 'HIGH',
    });

    return NextResponse.json(
      { success: true, change },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error in POST /api/audit/config-changes:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

