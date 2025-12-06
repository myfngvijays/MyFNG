import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/super_admin/car-brands
 * Get all car brands
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('active_only') === 'true';

    // For public access (home page), allow without auth check
    // For admin access, check authentication
    const authHeader = request.headers.get('authorization');
    const isPublicRequest = !authHeader;

    if (!isPublicRequest) {
      // Check authentication for admin requests
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      // Check if user is super admin (using roles table join)
      const { data: userData, error: roleError } = await supabase
        .from('users_login')
        .select('id, roles!inner(role_code)')
        .eq('id', user.id)
        .single();

      if (roleError || !userData) {
        console.error('Role check error:', roleError);
        return NextResponse.json({ error: 'Forbidden - Role check failed' }, { status: 403 });
      }

      const roleCode = (userData as any).roles?.role_code;
      if (roleCode !== 'SUPER_ADMIN') {
        return NextResponse.json({ error: 'Forbidden - Not super admin' }, { status: 403 });
      }
    }

    let query = supabase
      .from('web_car_brand')
      .select('*')
      .order('display_order', { ascending: true });

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching car brands:', error);
      return NextResponse.json({ error: 'Failed to fetch brands' }, { status: 500 });
    }

    return NextResponse.json({ data: data || [] });
  } catch (error: any) {
    console.error('Error in GET /api/super_admin/car-brands:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/super_admin/car-brands
 * Create a new car brand
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is super admin (using roles table join)
    const { data: userData, error: roleError } = await supabase
      .from('users_login')
      .select('id, roles!inner(role_code)')
      .eq('id', user.id)
      .single();

    if (roleError || !userData) {
      console.error('Role check error:', roleError);
      return NextResponse.json({ error: 'Forbidden - Role check failed' }, { status: 403 });
    }

    const roleCode = (userData as any).roles?.role_code;
    if (roleCode !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden - Not super admin' }, { status: 403 });
    }

    const body = await request.json();
    const { name, logo_url, display_order, is_active } = body;

    if (!name || !logo_url) {
      return NextResponse.json({ error: 'Name and logo URL are required' }, { status: 400 });
    }

    // Check if brand name already exists
    const { data: existing } = await supabase
      .from('web_car_brand')
      .select('id')
      .eq('name', name)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'Brand name already exists' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('web_car_brand')
      .insert({
        name,
        logo_url,
        display_order: display_order || 0,
        is_active: is_active !== undefined ? is_active : true,
        created_by: user.id,
        updated_by: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating car brand:', error);
      return NextResponse.json({ error: 'Failed to create brand' }, { status: 500 });
    }

    return NextResponse.json({ data, message: 'Brand created successfully' });
  } catch (error: any) {
    console.error('Error in POST /api/super_admin/car-brands:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

