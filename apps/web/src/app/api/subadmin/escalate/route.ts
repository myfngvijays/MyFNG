/**
 * Sub Admin Escalation API
 * POST /api/subadmin/escalate
 * Create or manage escalations
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/subadmin/escalate
 * Create new escalation or update existing escalation
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile
    const { data: userProfile, error: profileError } = await supabase
      .from('users_login')
      .select('id, department, full_name, roles!inner(role_code)')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const roleCode = (userProfile.roles as any)?.role_code;
    const department = userProfile.department;

    if (roleCode !== 'SUB_ADMIN' || !department) {
      return NextResponse.json({ error: 'Forbidden: Sub Admin role required' }, { status: 403 });
    }

    const body = await request.json();
    const {
      action, // 'CREATE' | 'ACKNOWLEDGE' | 'RESOLVE' | 'ESCALATE_TO_SUPERADMIN'
      escalation_id,
      escalation_type,
      priority,
      lead_id,
      ticket_id,
      audit_id,
      customer_id,
      workshop_id,
      team_member_id,
      escalation_reason,
      resolution_notes,
      resolution_action,
    } = body;

    if (action === 'CREATE') {
      // Create new escalation
      if (!escalation_type || !escalation_reason) {
        return NextResponse.json(
          { error: 'escalation_type and escalation_reason are required for CREATE' },
          { status: 400 }
        );
      }

      const { data: newEscalation, error: insertError } = await supabase
        .from('escalations')
        .insert({
          department: department,
          escalation_type: escalation_type,
          priority: priority || 'HIGH',
          status: 'OPEN',
          lead_id: lead_id || null,
          ticket_id: ticket_id || null,
          audit_id: audit_id || null,
          customer_id: customer_id || null,
          workshop_id: workshop_id || null,
          team_member_id: team_member_id || null,
          escalated_by: user.id,
          escalated_to: user.id, // Escalated to self (Sub Admin)
          escalation_reason: escalation_reason,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error creating escalation:', insertError);
        return NextResponse.json(
          { error: 'Failed to create escalation', details: insertError.message },
          { status: 500 }
        );
      }

      // Log action
      await supabase.from('subadmin_actions').insert({
        subadmin_id: user.id,
        department: department,
        action_type: 'CREATE_ESCALATION',
        action_description: `Created escalation: ${escalation_type}`,
        related_entity_type: 'ESCALATION',
        related_entity_id: newEscalation.id,
        metadata: {
          escalation_type: escalation_type,
          priority: priority || 'HIGH',
        },
      });

      return NextResponse.json({
        success: true,
        escalation: newEscalation,
        message: 'Escalation created successfully',
      });

    } else if (action === 'ACKNOWLEDGE') {
      // Acknowledge escalation
      if (!escalation_id) {
        return NextResponse.json({ error: 'escalation_id is required' }, { status: 400 });
      }

      const { data: updatedEscalation, error: updateError } = await supabase
        .from('escalations')
        .update({
          status: 'ACKNOWLEDGED',
          updated_at: new Date().toISOString(),
        })
        .eq('id', escalation_id)
        .eq('department', department)
        .select()
        .single();

      if (updateError || !updatedEscalation) {
        return NextResponse.json(
          { error: 'Failed to acknowledge escalation', details: updateError?.message },
          { status: 500 }
        );
      }

      // Log action
      await supabase.from('subadmin_actions').insert({
        subadmin_id: user.id,
        department: department,
        action_type: 'ACKNOWLEDGE_ESCALATION',
        action_description: `Acknowledged escalation ${escalation_id}`,
        related_entity_type: 'ESCALATION',
        related_entity_id: escalation_id,
      });

      return NextResponse.json({
        success: true,
        escalation: updatedEscalation,
        message: 'Escalation acknowledged',
      });

    } else if (action === 'RESOLVE') {
      // Resolve escalation
      if (!escalation_id || !resolution_notes) {
        return NextResponse.json(
          { error: 'escalation_id and resolution_notes are required for RESOLVE' },
          { status: 400 }
        );
      }

      const { data: updatedEscalation, error: updateError } = await supabase
        .from('escalations')
        .update({
          status: 'RESOLVED',
          resolved_by: user.id,
          resolved_at: new Date().toISOString(),
          resolution_notes: resolution_notes,
          resolution_action: resolution_action || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', escalation_id)
        .eq('department', department)
        .select()
        .single();

      if (updateError || !updatedEscalation) {
        return NextResponse.json(
          { error: 'Failed to resolve escalation', details: updateError?.message },
          { status: 500 }
        );
      }

      // Log action
      await supabase.from('subadmin_actions').insert({
        subadmin_id: user.id,
        department: department,
        action_type: 'RESOLVE_ESCALATION',
        action_description: `Resolved escalation ${escalation_id}`,
        related_entity_type: 'ESCALATION',
        related_entity_id: escalation_id,
        metadata: {
          resolution_notes: resolution_notes,
          resolution_action: resolution_action || null,
        },
      });

      return NextResponse.json({
        success: true,
        escalation: updatedEscalation,
        message: 'Escalation resolved',
      });

    } else if (action === 'ESCALATE_TO_SUPERADMIN') {
      // Escalate to Super Admin
      if (!escalation_id || !escalation_reason) {
        return NextResponse.json(
          { error: 'escalation_id and escalation_reason are required for ESCALATE_TO_SUPERADMIN' },
          { status: 400 }
        );
      }

      const { data: updatedEscalation, error: updateError } = await supabase
        .from('escalations')
        .update({
          status: 'ESCALATED_TO_SUPERADMIN',
          escalated_to_superadmin: true,
          escalated_to_superadmin_at: new Date().toISOString(),
          superadmin_notes: escalation_reason,
          updated_at: new Date().toISOString(),
        })
        .eq('id', escalation_id)
        .eq('department', department)
        .select()
        .single();

      if (updateError || !updatedEscalation) {
        return NextResponse.json(
          { error: 'Failed to escalate to Super Admin', details: updateError?.message },
          { status: 500 }
        );
      }

      // Log action
      await supabase.from('subadmin_actions').insert({
        subadmin_id: user.id,
        department: department,
        action_type: 'ESCALATE_TO_SUPERADMIN',
        action_description: `Escalated ${escalation_id} to Super Admin`,
        related_entity_type: 'ESCALATION',
        related_entity_id: escalation_id,
        metadata: {
          escalation_reason: escalation_reason,
        },
      });

      return NextResponse.json({
        success: true,
        escalation: updatedEscalation,
        message: 'Escalation forwarded to Super Admin',
      });

    } else {
      return NextResponse.json(
        { error: 'Invalid action. Must be CREATE, ACKNOWLEDGE, RESOLVE, or ESCALATE_TO_SUPERADMIN' },
        { status: 400 }
      );
    }

  } catch (error: any) {
    console.error('Error in POST /api/subadmin/escalate:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/subadmin/escalate
 * Get escalations for Sub Admin's department
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile
    const { data: userProfile, error: profileError } = await supabase
      .from('users_login')
      .select('id, department, roles!inner(role_code)')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const roleCode = (userProfile.roles as any)?.role_code;
    const department = userProfile.department;

    if (roleCode !== 'SUB_ADMIN' || !department) {
      return NextResponse.json({ error: 'Forbidden: Sub Admin role required' }, { status: 403 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    // Build query - use simpler select to avoid join errors
    let query = supabase
      .from('escalations')
      .select('*', { count: 'exact' })
      .eq('department', department);

    // Filter by status (only if not 'all')
    if (status && status !== 'all') {
      query = query.in('status', status.split(','));
    }

    // Filter by priority (only if not 'all')
    if (priority && priority !== 'all') {
      query = query.in('priority', priority.split(','));
    }

    // Search filter (if provided)
    if (search) {
      query = query.or(`escalation_reason.ilike.%${search}%,escalation_type.ilike.%${search}%`);
    }

    // Order by priority and created date
    query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

    const { data: escalations, error, count } = await query;

    if (error) {
      console.error('Error fetching escalations:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      
      // Check if table doesn't exist
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return NextResponse.json({ 
          error: 'Escalations table not found',
          details: 'The escalations table may not exist in the database. Please check database schema.',
          code: error.code
        }, { status: 500 });
      }
      
      return NextResponse.json({ 
        error: 'Failed to fetch escalations',
        details: error.message,
        code: error.code,
        hint: error.hint
      }, { status: 500 });
    }

    return NextResponse.json({
      escalations: escalations || [],
      pagination: {
        page: page,
        limit: limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit),
      },
      department: department,
    });

  } catch (error: any) {
    console.error('Error in GET /api/subadmin/escalate:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

