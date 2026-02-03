import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// POST: Add item (Product) to Service Type (Package)
export async function POST(
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

    // Check Super Admin role
    const { data: userRole } = await supabase
      .from('users_login')
      .select('roles(role_code)')
      .eq('id', session.user.id)
      .single();

    // @ts-ignore
    if (userRole?.roles?.role_code !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { product_id, quantity } = body;

    if (!product_id) {
        return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }

    // Insert into service_type_items
    const { data, error } = await supabase
      .from('service_type_items')
      .insert({
        service_type_id: id,
        product_id: product_id,
        quantity: quantity || 1
      })
      .select()
      .single();

    if (error) {
        // Handle unique constraint violation (duplicate item)
        if (error.code === '23505') {
            return NextResponse.json({ error: 'This product is already added to this service package' }, { status: 409 });
        }
        throw error;
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error adding package item:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: Remove item from Service Type (Package)
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

    // Check Super Admin role
    const { data: userRole } = await supabase
      .from('users_login')
      .select('roles(role_code)')
      .eq('id', session.user.id)
      .single();

    // @ts-ignore
    if (userRole?.roles?.role_code !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get('item_id');

    if (!itemId) {
        return NextResponse.json({ error: 'Item ID is required' }, { status: 400 });
    }

    // Delete item and verify it belongs to the service type for security
    const { error: deleteError } = await supabase
      .from('service_type_items')
      .delete()
      .eq('id', itemId)
      .eq('service_type_id', id);

    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
