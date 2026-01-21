import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { pickTelecallerWeightedRoundRobin } from '@/lib/enquiry/assignment';

async function requireSuperAdmin(request: NextRequest) {
  const supabase = await createClientFromRequest(request);
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { ok: false as const, status: 401, error: 'Unauthorized' };

  const { data: userProfile, error: profileError } = await supabase
    .from('users_login')
    .select('role:roles!role_id(role_code)')
    .eq('id', user.id)
    .single();

  const roleCode = (userProfile?.role as any)?.role_code;
  if (profileError || roleCode !== 'SUPER_ADMIN') {
    return { ok: false as const, status: 403, error: 'Forbidden' };
  }

  return { ok: true as const, userId: user.id };
}

export async function POST(request: NextRequest) {
  try {
    const gate = await requireSuperAdmin(request);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) return NextResponse.json({ error: adminError }, { status: 500 });

    const maxTotal = 500;
    const batchSize = 100;
    let assignedCount = 0;
    let skippedCount = 0;
    let processed = 0;

    while (processed < maxTotal) {
      const { data: leads, error } = await supabaseAdmin
        .from('enquiry_hub')
        .select('id, history')
        .eq('kind', 'LEAD')
        .is('assigned_telecaller_id', null)
        .order('created_at', { ascending: true })
        .limit(batchSize);

      if (error) throw error;
      if (!leads || leads.length === 0) break;

      for (const lead of leads) {
        const { telecallerId, reason } = await pickTelecallerWeightedRoundRobin();
        const now = new Date().toISOString();

        if (!telecallerId) {
          skippedCount += 1;
          processed += 1;
          continue;
        }

        const history = Array.isArray((lead as any).history) ? (lead as any).history : [];
        history.push({ type: 'ASSIGNED', at: now, mode: 'AUTO', telecaller_id: telecallerId });

        const { error: updateErr } = await supabaseAdmin
          .from('enquiry_hub')
          .update({
            assigned_telecaller_id: telecallerId,
            assigned_at: now,
            assignment_mode: 'AUTO',
            lead_status: 'ASSIGNED',
            history,
            meta: reason ? { assignment_error: reason } : {},
            updated_at: now,
          })
          .eq('id', (lead as any).id);

        if (updateErr) throw updateErr;
        assignedCount += 1;
        processed += 1;
      }
    }

    return NextResponse.json({
      success: true,
      assignedCount,
      skippedCount,
      processed,
      remainingEstimate: Math.max(0, maxTotal - processed),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
