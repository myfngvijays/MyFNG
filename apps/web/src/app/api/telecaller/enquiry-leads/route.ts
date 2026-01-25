import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClientFromRequest(request);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userProfile = await resolveUserProfile(supabase, user);
    const roleCode = (userProfile?.roles as any)?.role_code || null;
    if (roleCode !== 'TELECALLER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data, error } = await supabase
      .from('enquiry_hub')
      .select(
        'id, lead_number, lead_type, lead_status, lead_priority, lead_source, customer_name, customer_phone, assigned_at, next_follow_up_at, total_calls, meta'
      )
      .eq('kind', 'LEAD')
      .eq('assigned_telecaller_id', userProfile?.id)
      .order('assigned_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ leads: data || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

