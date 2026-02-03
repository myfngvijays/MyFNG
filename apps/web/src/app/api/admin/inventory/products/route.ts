import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// GET: List all master products
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const search = searchParams.get('search');

    // Auth Check
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    let query = supabase
      .from('master_products')
      .select('*')
      .order('created_at', { ascending: false });

    if (type) {
      query = query.eq('type', type);
    }

    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching products:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Create a new master product
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    
    // Auth Check
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate Role
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
    const { 
      name, type, category, hsn_sac_code, 
      default_price, tax_rate, unit, 
      manufacturer, part_number, is_active 
    } = body;

    if (!name || !type || !default_price) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Create Product
    const { data, error } = await supabase
      .from('master_products')
      .insert([{
        name, type, category, hsn_sac_code,
        default_price, tax_rate: tax_rate || 18.00, unit,
        manufacturer, part_number, is_active
      }])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error creating product:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
