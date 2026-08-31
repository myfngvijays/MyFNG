import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { ensureLeadServiceChecklist, parseServiceChecklistItems } from '@/lib/workshop/ensureServiceChecklist';

const ADVISOR_ROLES = new Set(['WORKSHOP_SUPERVISOR', 'WORKSHOP_ADMIN', 'WORKSHOP_MECHANIC']);

/** POST /api/leads/[id]/ensure-checklist — backfill service checklist for assigned mechanic */
export async function POST(
  _request: Request,
  { params: paramsPromise }: { params: Promise<{ id: string }> },
) {
  const params = await paramsPromise;
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('users_login')
      .select('workshop_id, roles!inner(role_code)')
      .eq('id', user.id)
      .single();

    const roleCode = (profile?.roles as { role_code?: string })?.role_code;
    if (!profile || !roleCode || !ADVISOR_ROLES.has(roleCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const leadId = params.id;
    const { data: lead } = await supabase
      .from('service_leads')
      .select('id, workshop_id, assigned_mechanic_id, service_type')
      .eq('id', leadId)
      .single();

    if (!lead || lead.workshop_id !== profile.workshop_id) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    if (!lead.assigned_mechanic_id) {
      return NextResponse.json({ error: 'Mechanic not assigned yet' }, { status: 400 });
    }

    const { supabaseAdmin, error: adminErr } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: adminErr || 'Server config error' }, { status: 500 });
    }

    await ensureLeadServiceChecklist(supabaseAdmin, leadId, lead.assigned_mechanic_id);

    const { data: checklist } = await supabaseAdmin
      .from('service_checklists')
      .select('id, checklist_items, total_items, completed_items, completion_percentage')
      .eq('lead_id', leadId)
      .eq('mechanic_id', lead.assigned_mechanic_id)
      .maybeSingle();

    return NextResponse.json({
      success: true,
      items: parseServiceChecklistItems(checklist?.checklist_items),
      total_items: checklist?.total_items ?? 0,
      completed_items: checklist?.completed_items ?? 0,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to ensure checklist', details: message }, { status: 500 });
  }
}
