import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// GET: Fetch single package with items (NOW SERVICE TYPES)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch Service Type (Package) and mapped Products
    const { data: pkg, error } = await supabase
      .from('service_types')
      .select(`
        *,
        items:service_type_items(
          id,
          quantity,
          product:master_products(id, name, type, default_price, part_number, unit)
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;

    // Map to match expected frontend structure if needed
    // Frontend expects: pkg.items[].product
    
    return NextResponse.json(pkg);
  } catch (error: any) {
    console.error('Error fetching package:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT: Update package details
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, hsn_sac_code, default_tax_rate, is_active } = body;

    const { data, error } = await supabase
      .from('service_types')
      .update({
        name,
        description,
        hsn_sac_code,
        default_tax_rate: default_tax_rate || 18.00,
        is_active
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error updating package:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: Delete package (Service Type)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if Super Admin (Critical for delete)
    const { data: userData } = await supabase
      .from('users_login')
      .select('roles:role_id (role_code)')
      .eq('id', session.user.id)
      .single();

    // @ts-ignore
    if (userData?.roles?.role_code !== 'SUPER_ADMIN') {
       return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { error } = await supabase
      .from('service_types')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
