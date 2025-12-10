/**
 * Blog Tags API Routes
 * GET /api/blogs/tags - List all tags
 * POST /api/blogs/tags - Create a new tag
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: tags, error } = await supabase
      .from('blog_tags')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('Tags fetch error:', error);
      return NextResponse.json({ error: 'Failed to fetch tags', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ tags: tags || [] });
  } catch (error: any) {
    console.error('Tags GET error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}

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
      .select('id, roles!inner(role_code)')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const roleCode = (userProfile.roles as any)?.role_code;

    // Only DIGITAL_MARKETING and SUPER_ADMIN can manage tags
    if (roleCode !== 'DIGITAL_MARKETING' && roleCode !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Only Digital Marketing can manage tags' }, { status: 403 });
    }

    const body = await request.json();
    const { name, slug } = body;

    if (!name || !slug) {
      return NextResponse.json({ error: 'Name and slug are required' }, { status: 400 });
    }

    // Check if slug already exists
    const { data: existing } = await supabase
      .from('blog_tags')
      .select('id')
      .eq('slug', slug)
      .single();

    if (existing) {
      return NextResponse.json({ error: 'Tag with this slug already exists' }, { status: 400 });
    }

    const { data: tag, error: createError } = await supabase
      .from('blog_tags')
      .insert({
        name,
        slug
      })
      .select()
      .single();

    if (createError) {
      console.error('Tag creation error:', createError);
      return NextResponse.json({ error: 'Failed to create tag', details: createError.message }, { status: 500 });
    }

    return NextResponse.json({ tag }, { status: 201 });
  } catch (error: any) {
    console.error('Tags POST error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
