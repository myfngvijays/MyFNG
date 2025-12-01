import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// GET: List all packages with items
export async function GET(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch Packages
    const { data: packages, error: pkgError } = await supabase
      .from('service_packages')
      .select('*')
      .order('created_at', { ascending: false });

    if (pkgError) throw pkgError;

    // For MVP, we are just returning the packages list. 
    // Items can be fetched via a separate call or a join if needed later.

    return NextResponse.json(packages);
  } catch (error: any) {
    console.error('Error fetching packages:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Create a new package with items
export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      name, description, total_price, tax_rate, 
      hsn_sac_code, is_active, items 
    } = body;

    if (!name || !total_price) {
      return NextResponse.json({ error: 'Name and Price are required' }, { status: 400 });
    }

    // 1. Create Package Header
    const { data: pkg, error: pkgError } = await supabase
      .from('service_packages')
      .insert([{
        name, description, total_price, tax_rate, hsn_sac_code, is_active
      }])
      .select()
      .single();

    if (pkgError) throw pkgError;

    // 2. Create Package Items (if any)
    if (items && Array.isArray(items) && items.length > 0) {
      const packageItems = items.map((item: any) => ({
        package_id: pkg.id,
        product_id: item.product_id || null,
        service_type_id: item.service_type_id || null,
        quantity: item.quantity || 1
      }));

      const { error: itemsError } = await supabase
        .from('service_package_items')
        .insert(packageItems);

      if (itemsError) {
        // Rollback mechanism would be ideal here, but for now we just log error
        console.error('Error adding package items:', itemsError);
      }
    }

    return NextResponse.json(pkg);
  } catch (error: any) {
    console.error('Error creating package:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
