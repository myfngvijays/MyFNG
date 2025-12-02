import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// GET: List all Service Types (treated as Packages)
export async function GET(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Debug: Check user role
    const { data: userData, error: roleError } = await supabase
      .from('users_login')
      .select(`
        id,
        roles:role_id (role_code)
      `)
      .eq('id', session.user.id)
      .single();

    // @ts-ignore
    const roleCode = userData?.roles?.role_code;
    
    // Allow SUPER_ADMIN and other relevant roles to view packages
    if (!roleCode) {
       return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch Service Types (Packages)
    // We treat service_types as "Packages" now
    const { data: packages, error: pkgError } = await supabase
      .from('service_types')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (pkgError) {
      console.error('Error fetching service types:', pkgError);
      return NextResponse.json({ error: pkgError.message }, { status: 500 });
    }

    // Map to match expected UI structure if needed, or just return as is
    // The UI expects: id, name, description, is_active. 
    // service_types has these columns.
    
    return NextResponse.json(packages || []);
  } catch (error: any) {
    console.error('Error fetching packages:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Create a new Service Type (Package)
export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Check Super Admin role
    const { data: userData } = await supabase
      .from('users_login')
      .select('roles:role_id (role_code)')
      .eq('id', session.user.id)
      .single();

    // @ts-ignore
    if (userData?.roles?.role_code !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { 
      name, description, hsn_sac_code, default_tax_rate, is_active
    } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // Insert into service_types
    const { data: pkg, error: pkgError } = await supabase
      .from('service_types')
      .insert([{
        name, 
        description, 
        hsn_sac_code, 
        default_tax_rate: default_tax_rate || 18.00,
        is_active: is_active !== undefined ? is_active : true
      }])
      .select()
      .single();

    if (pkgError) throw pkgError;

    return NextResponse.json(pkg);
  } catch (error: any) {
    console.error('Error creating package:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
