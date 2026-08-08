import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';
import { redactLeadSourceForTelecaller } from '@/lib/telecaller/redactLeadSource';

export async function GET(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClientFromRequest(request);
    const params = await paramsPromise;
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userProfile = await resolveUserProfile(supabase, user);
    const roleCode = (userProfile?.roles as any)?.role_code || null;
    if (roleCode !== 'TELECALLER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const leadId = String(params?.id || '').trim();
    if (!leadId) return NextResponse.json({ error: 'Missing lead id' }, { status: 400 });

    const { data, error } = await supabase
      .from('enquiry_hub')
      .select('*')
      .eq('kind', 'LEAD')
      .eq('id', leadId)
      .single();

    if (error || !data) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

    if (String((data as any)?.assigned_telecaller_id || '') !== String(userProfile?.id || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ lead: redactLeadSourceForTelecaller(data as Record<string, any>) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

