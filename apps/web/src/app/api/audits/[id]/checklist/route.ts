/**
 * Audit Checklist API
 * Purpose: Manage audit checklist items
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise;
  try {
    const supabase = await createClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const auditId = params.id;

    const { data: checklistItems, error: checklistError } = await supabase
      .from('audit_checklist_items')
      .select('*')
      .eq('audit_id', auditId)
      .order('category', { ascending: true });

    if (checklistError) {
      console.error('Error fetching checklist:', checklistError);
      return NextResponse.json({ error: 'Failed to fetch checklist' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      checklist_items: checklistItems || [],
    }, { status: 200 });

  } catch (error) {
    console.error('Error in get checklist API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Add Checklist Item
 */
export async function POST(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise;
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

    // Verify user is auditor
    if (userProfile.role !== 'auditor' && userProfile.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden: Auditor only' }, { status: 403 });
    }

    const auditId = params.id;
    const body = await request.json();
    const {
      category,
      item_name,
      item_description,
      max_points,
      is_critical,
      is_mandatory,
    } = body;

    if (!category || !item_name) {
      return NextResponse.json({
        error: 'Missing required fields: category, item_name',
      }, { status: 400 });
    }

    const { data: checklistItem, error: itemError } = await supabase
      .from('audit_checklist_items')
      .insert({
        audit_id: auditId,
        category: category,
        item_name: item_name,
        item_description: item_description,
        max_points: max_points || 10,
        is_critical: is_critical || false,
        is_mandatory: is_mandatory !== undefined ? is_mandatory : true,
        status: 'PENDING',
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (itemError) {
      console.error('Error creating checklist item:', itemError);
      return NextResponse.json({ error: 'Failed to create checklist item' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Checklist item added successfully',
      checklist_item: checklistItem,
    }, { status: 201 });

  } catch (error) {
    console.error('Error in add checklist item API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Update Checklist Item
 */
export async function PATCH(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise;
  try {
    const supabase = await createClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const auditId = params.id;
    const body = await request.json();
    const { item_id, points_awarded, status, auditor_notes, issues_found } = body;

    if (!item_id) {
      return NextResponse.json({
        error: 'Missing required field: item_id',
      }, { status: 400 });
    }

    const updateData: any = {};

    if (points_awarded !== undefined) {
      updateData.points_awarded = points_awarded;
    }

    if (status) {
      updateData.status = status;
    }

    if (auditor_notes) {
      updateData.auditor_notes = auditor_notes;
    }

    if (issues_found) {
      updateData.issues_found = issues_found;
    }

    if (status === 'VERIFIED' || status === 'FAILED') {
      updateData.checked_at = new Date().toISOString();
    }

    const { data: updatedItem, error: updateError } = await supabase
      .from('audit_checklist_items')
      .update(updateData)
      .eq('id', item_id)
      .eq('audit_id', auditId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating checklist item:', updateError);
      return NextResponse.json({ error: 'Failed to update checklist item' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Checklist item updated successfully',
      checklist_item: updatedItem,
    }, { status: 200 });

  } catch (error) {
    console.error('Error in update checklist item API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

