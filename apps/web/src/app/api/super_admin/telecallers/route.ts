import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData, error: roleError } = await supabase
      .from('users_login')
      .select('id, roles!inner(role_code)')
      .eq('id', user.id)
      .single();
    if (roleError || !userData) {
      return NextResponse.json({ error: 'Forbidden - Role check failed' }, { status: 403 });
    }
    const roleCode = (userData as any).roles?.role_code;
    if (!['SUPER_ADMIN', 'SUB_ADMIN', 'APP_OPERATIONS'].includes(roleCode)) {
      return NextResponse.json({ error: 'Forbidden - Not super admin' }, { status: 403 });
    }

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: adminError || 'Admin client not configured' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const role = String(searchParams.get('role') || 'TELECALLER').toUpperCase();
    if (!['TELECALLER', 'RSA_MANAGER'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role filter' }, { status: 400 });
    }

    const { data: telecallers, error } = await supabaseAdmin
      .from('users_login')
      .select('id, full_name, email, phone, roles!inner(role_code)')
      .eq('roles.role_code', role)
      .order('full_name', { ascending: true });

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch telecallers' }, { status: 500 });
    }

    return NextResponse.json({ telecallers: telecallers || [], role });
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal server error', details: error?.message }, { status: 500 });
  }
}
