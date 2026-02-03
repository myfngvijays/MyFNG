import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';

export async function POST(
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

    const body = await request.json().catch(() => ({}));
    const callStatus = String(body?.call_status || 'ANSWERED').toUpperCase();
    const duration = body?.call_duration != null ? Number(body.call_duration) : null;
    const summary = body?.summary ? String(body.summary) : null;
    const nextFollowUpAt = body?.next_follow_up_at || null;

    const { data: lead, error: leadErr } = await supabase
      .from('enquiry_hub')
      .select('id, assigned_telecaller_id, history, total_calls, lead_status')
      .eq('kind', 'LEAD')
      .eq('id', leadId)
      .single();
    if (leadErr || !lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    if (String((lead as any)?.assigned_telecaller_id || '') !== String(userProfile?.id || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const history = Array.isArray((lead as any).history) ? (lead as any).history : [];
    const now = new Date().toISOString();
    const updatedHistory = [
      ...history,
      {
        type: 'CALL',
        at: now,
        by: userProfile?.id,
        status: callStatus,
        duration,
        summary,
        next_follow_up_at: nextFollowUpAt,
      },
    ];

    const totalCalls = Number((lead as any)?.total_calls || 0) + 1;
    const leadStatus = nextFollowUpAt ? 'FOLLOW_UP' : (['NEW', 'ASSIGNED'].includes(String((lead as any)?.lead_status || '')) ? 'IN_PROGRESS' : (lead as any)?.lead_status);

    const { error: updateErr } = await supabase
      .from('enquiry_hub')
      .update({
        history: updatedHistory,
        total_calls: totalCalls,
        last_call_at: now,
        next_follow_up_at: nextFollowUpAt,
        lead_status: leadStatus,
      })
      .eq('id', leadId)
      .eq('kind', 'LEAD');

    if (updateErr) throw updateErr;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

