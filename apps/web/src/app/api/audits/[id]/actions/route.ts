/**
 * Audit Action Items API
 * Purpose: Manage audit action items
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
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

    const auditId = params.id;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    let query = supabase
      .from('audit_action_items')
      .select(`
        *,
        assigned_user:users_login!assigned_to(id, full_name, role),
        assigned_by_user:users_login!assigned_by(id, full_name),
        verified_by_user:users_login!verified_by(id, full_name)
      `)
      .eq('audit_id', auditId)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data: actionItems, error: actionError } = await query;

    if (actionError) {
      console.error('Error fetching action items:', actionError);
      return NextResponse.json({ error: 'Failed to fetch action items' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      action_items: actionItems || [],
      total: actionItems?.length || 0,
    }, { status: 200 });

  } catch (error) {
    console.error('Error in get action items API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Create Action Item
 */
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

    // Get user profile
    const { data: userProfile, error: profileError } = await supabase
      .from('users_login')
      .select('id, role')
      .eq('email', user.email)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const auditId = params.id;
    const body = await request.json();
    const {
      workshop_id,
      action_title,
      action_description,
      priority,
      category,
      assigned_to,
      due_date,
    } = body;

    if (!workshop_id || !action_title || !action_description) {
      return NextResponse.json({
        error: 'Missing required fields: workshop_id, action_title, action_description',
      }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Get audit to get workshop_id
    const { data: audit } = await supabase
      .from('workshop_audits')
      .select('workshop_id')
      .eq('id', auditId)
      .single();

    const { data: actionItem, error: itemError } = await supabase
      .from('audit_action_items')
      .insert({
        audit_id: auditId,
        workshop_id: workshop_id || audit?.workshop_id,
        action_title: action_title,
        action_description: action_description,
        priority: priority || 'MEDIUM',
        category: category,
        assigned_to: assigned_to,
        assigned_by: userProfile.id,
        assigned_at: now,
        due_date: due_date,
        status: 'OPEN',
        is_overdue: false,
        created_at: now,
      })
      .select()
      .single();

    if (itemError) {
      console.error('Error creating action item:', itemError);
      return NextResponse.json({ error: 'Failed to create action item' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Action item created successfully',
      action_item: actionItem,
    }, { status: 201 });

  } catch (error) {
    console.error('Error in create action item API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

