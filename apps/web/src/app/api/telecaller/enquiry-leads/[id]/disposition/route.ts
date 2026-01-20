import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';

const DISPOSITIONS = [
  'CUSTOMER_NOT_INTERESTED',
  'WRONG_NUMBER',
  'DUPLICATE_LEAD',
  'ALREADY_SERVICED_ELSEWHERE',
  'QUALIFIED',
];

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
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

    const leadId = String(params?.id || '').trim();
    if (!leadId) return NextResponse.json({ error: 'Missing lead id' }, { status: 400 });

    const body = await request.json().catch(() => ({}));
    const disposition = String(body?.disposition || '').trim().toUpperCase();
    const note = body?.note ? String(body.note) : null;
    const nextFollowUpAt = body?.next_follow_up_at || null;

    if (!DISPOSITIONS.includes(disposition)) {
      return NextResponse.json({ error: 'Invalid disposition' }, { status: 400 });
    }

    const { data: lead, error: leadErr } = await supabase
      .from('enquiry_hub')
      .select('id, assigned_telecaller_id, history')
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
        type: 'DISPOSITION',
        at: now,
        by: userProfile?.id,
        disposition,
        note,
        next_follow_up_at: nextFollowUpAt,
      },
    ];

    const leadStatus = nextFollowUpAt ? 'FOLLOW_UP' : 'CLOSED';

    const { error: updateErr } = await supabase
      .from('enquiry_hub')
      .update({
        disposition,
        disposition_note: note,
        lead_status: leadStatus,
        next_follow_up_at: nextFollowUpAt,
        closed_at: leadStatus === 'CLOSED' ? now : null,
        history: updatedHistory,
      })
      .eq('id', leadId)
      .eq('kind', 'LEAD');

    if (updateErr) throw updateErr;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

