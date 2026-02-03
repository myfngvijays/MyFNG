import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// GET: List all zones
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    
    // Auth Check
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch Zones
    const { data, error } = await supabase
      .from('zones')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching zones:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Create a new zone
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    
    // Auth Check
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate Role (Super Admin Only)
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
    const { name, description, is_active } = body;

    if (!name) {
      return NextResponse.json({ error: 'Zone name is required' }, { status: 400 });
    }

    // Create Zone
    const { data, error } = await supabase
      .from('zones')
      .insert([{ name, description, is_active }])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error creating zone:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
