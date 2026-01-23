/**
 * Blog Categories API Routes
 * GET /api/blogs/categories - List all categories
 * POST /api/blogs/categories - Create a new category
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const manage = searchParams.get('manage') === '1';

    // Management listing: require auth + DIGITAL_MARKETING / SUPER_ADMIN
    if (manage) {
      const { createClient: createServerClient } = await import('@/lib/supabase/server');
      const supabase = await createServerClient();

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const { data: userProfile, error: profileError } = await supabase
        .from('users_login')
        .select('id, roles!inner(role_code)')
        .eq('id', user.id)
        .single();

      if (profileError || !userProfile) {
        return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
      }

      const roleCode = (userProfile.roles as any)?.role_code;
      if (roleCode !== 'DIGITAL_MARKETING' && roleCode !== 'SUPER_ADMIN') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      let query = supabase
        .from('blog_categories')
        .select('*')
        .order('name', { ascending: true });

      // Optional status filter (for admin views)
      if (status !== null) {
        const parsed = parseInt(status);
        if (!Number.isNaN(parsed)) query = query.eq('status', parsed);
      }

      const { data: categories, error } = await query;
      if (error) {
        console.error('Categories fetch error:', error);
        return NextResponse.json({ error: 'Failed to fetch categories', details: error.message }, { status: 500 });
      }

      return NextResponse.json({ categories: categories || [] });
    }

    // Public access: use anonymous Supabase client (active categories only by default)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: 'Supabase configuration missing' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false }
    });

    let query = supabase
      .from('blog_categories')
      .select('*')
      .order('name', { ascending: true });

    // Filter by status if provided
    if (status !== null) {
      const parsed = parseInt(status);
      if (!Number.isNaN(parsed)) query = query.eq('status', parsed);
    } else {
      // Default: only active categories for public access
      query = query.eq('status', 1);
    }

    const { data: categories, error } = await query;

    if (error) {
      console.error('Categories fetch error:', error);
      return NextResponse.json({ error: 'Failed to fetch categories', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ categories: categories || [] });
  } catch (error: any) {
    console.error('Categories GET error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { createClient: createServerClient } = await import('@/lib/supabase/server');
    const supabase = await createServerClient();
    
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

    // Only DIGITAL_MARKETING and SUPER_ADMIN can manage categories
    if (roleCode !== 'DIGITAL_MARKETING' && roleCode !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Only Digital Marketing can manage categories' }, { status: 403 });
    }

    const body = await request.json();
    const { name, slug, description, status = 1 } = body;

    if (!name || !slug) {
      return NextResponse.json({ error: 'Name and slug are required' }, { status: 400 });
    }

    // Check if slug already exists
    const { data: existing } = await supabase
      .from('blog_categories')
      .select('id')
      .eq('slug', slug)
      .single();

    if (existing) {
      return NextResponse.json({ error: 'Category with this slug already exists' }, { status: 400 });
    }

    const { data: category, error: createError } = await supabase
      .from('blog_categories')
      .insert({
        name,
        slug,
        description,
        status
      })
      .select()
      .single();

    if (createError) {
      console.error('Category creation error:', createError);
      return NextResponse.json({ error: 'Failed to create category', details: createError.message }, { status: 500 });
    }

    return NextResponse.json({ category }, { status: 201 });
  } catch (error: any) {
    console.error('Categories POST error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
