import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * PUT /api/super_admin/car-brands/[id]
 * Update a car brand
 */
export async function PUT(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise;
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

    const updateData: any = {
      updated_by: user.id,
    };

    if (name !== undefined) updateData.name = name;
    if (logo_url !== undefined) updateData.logo_url = logo_url;
    if (display_order !== undefined) updateData.display_order = display_order;
    if (is_active !== undefined) updateData.is_active = is_active;

      // Check if brand name already exists (if name is being changed)
    if (name) {
      const { data: existing } = await supabase
        .from('web_car_brand')
        .select('id')
        .eq('name', name)
        .neq('id', params.id)
        .maybeSingle();

      if (existing) {
        return NextResponse.json({ error: 'Brand name already exists' }, { status: 400 });
      }
    }

    const { data, error } = await supabase
      .from('web_car_brand')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating car brand:', error);
      return NextResponse.json({ error: 'Failed to update brand' }, { status: 500 });
    }

    return NextResponse.json({ data, message: 'Brand updated successfully' });
  } catch (error: any) {
    console.error('Error in PUT /api/super_admin/car-brands/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/super_admin/car-brands/[id]
 * Delete a car brand
 */
export async function DELETE(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise;
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

    const { error } = await supabase
      .from('web_car_brand')
      .delete()
      .eq('id', params.id);

    if (error) {
      console.error('Error deleting car brand:', error);
      return NextResponse.json({ error: 'Failed to delete brand' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Brand deleted successfully' });
  } catch (error: any) {
    console.error('Error in DELETE /api/super_admin/car-brands/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

