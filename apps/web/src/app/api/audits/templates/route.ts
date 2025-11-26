/**
 * Audit Templates API
 * Purpose: Manage audit templates
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const audit_type = searchParams.get('audit_type');
    const is_active = searchParams.get('is_active');

    let query = supabase
      .from('audit_templates')
      .select('*')
      .order('created_at', { ascending: false });

    if (audit_type) {
      query = query.eq('audit_type', audit_type);
    }

    if (is_active !== null) {
      query = query.eq('is_active', is_active === 'true');
    }

    const { data: templates, error: templatesError } = await query;

    if (templatesError) {
      console.error('Error fetching templates:', templatesError);
      return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      templates: templates || [],
      total: templates?.length || 0,
    }, { status: 200 });

  } catch (error) {
    console.error('Error in get templates API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Create Template
 */
export async function POST(request: NextRequest) {
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

    // Verify user has admin permissions
    const allowedRoles = ['super_admin', 'sub_admin'];
    if (!allowedRoles.includes(userProfile.role)) {
      return NextResponse.json({ error: 'Forbidden: Admin only' }, { status: 403 });
    }

    const body = await request.json();
    const {
      template_name,
      template_description,
      audit_type,
      checklist_items,
      category_weights,
    } = body;

    if (!template_name || !audit_type) {
      return NextResponse.json({
        error: 'Missing required fields: template_name, audit_type',
      }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Create template
    const { data: template, error: templateError } = await supabase
      .from('audit_templates')
      .insert({
        template_name: template_name,
        template_description: template_description,
        audit_type: audit_type,
        checklist_items: checklist_items || [],
        category_weights: category_weights || {},
        is_active: true,
        version: 1,
        created_by: userProfile.id,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (templateError) {
      console.error('Error creating template:', templateError);
      return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Audit template created successfully',
      template: template,
    }, { status: 201 });

  } catch (error) {
    console.error('Error in create template API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

