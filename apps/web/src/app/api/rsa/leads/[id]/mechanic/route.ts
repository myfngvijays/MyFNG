import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

function parseAmount(value: any): number | null {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const cleaned = raw.replace(/[^\d.]/g, '');
  if (!cleaned) return null;
  const num = Number(cleaned);
  if (!isFinite(num)) return null;
  return num;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const leadId = String(id || '').trim();
    if (!leadId) return NextResponse.json({ error: 'Missing lead id' }, { status: 400 });

    const supabase = await createClientFromRequest(request);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userProfile = await resolveUserProfile(supabase as any, user as any);
    const roleCode = String((userProfile?.roles as any)?.role_code || '');
    const allowed = new Set(['RSA_MANAGER', 'SUPER_ADMIN', 'SUB_ADMIN']);
    if (!allowed.has(roleCode)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    const mechanicId = String(body?.mechanic_id || '').trim();
    if (!mechanicId) return NextResponse.json({ error: 'mechanic_id is required' }, { status: 400 });
    const paymentAmount = parseAmount(body?.payment_to_mechanic);
    const remark = String(body?.remark || '').trim() || null;

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: adminError || 'Admin client not configured' }, { status: 500 });
    }

    // RSA_MANAGER can change only their own claimed lead
    if (roleCode === 'RSA_MANAGER') {
      const { data: leadRow, error: leadErr } = await (supabaseAdmin as any)
        .from('rsa_leads')
        .select('id, assigned_manager_id, assigned_mechanic_id')
        .eq('id', leadId)
        .single();
      if (leadErr) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
      if (String(leadRow?.assigned_manager_id || '') !== String(user.id)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Load current lead & mechanic
    const { data: lead, error: leadError } = await (supabaseAdmin as any)
      .from('rsa_leads')
      .select('id, assigned_mechanic_id, assigned_manager_id, assigned_manager_name')
      .eq('id', leadId)
      .single();
    if (leadError || !lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

    const prevMechanicId = lead.assigned_mechanic_id ? String(lead.assigned_mechanic_id) : null;

    const { data: mechanic, error: mechError } = await (supabaseAdmin as any)
      .from('company_mechanic_rsa')
      .select('id, mechanic_name, number')
      .eq('id', mechanicId)
      .single();
    if (mechError || !mechanic) return NextResponse.json({ error: 'Mechanic not found' }, { status: 404 });

    const now = new Date().toISOString();

    // Free previous mechanic
    if (prevMechanicId && prevMechanicId !== mechanicId) {
      try {
        await (supabaseAdmin as any)
          .from('company_mechanic_rsa')
          .update({ current_assignment_id: null, is_available: true, updated_at: now } as any)
          .eq('id', prevMechanicId);
      } catch {
        // ignore
      }
    }

    // Assign new mechanic
    await (supabaseAdmin as any)
      .from('company_mechanic_rsa')
      .update({ current_assignment_id: leadId, is_available: false, updated_at: now } as any)
      .eq('id', mechanicId);

    const updateLeadPayload: any = {
      assigned_mechanic_id: mechanicId,
      assigned_mechanic_name: mechanic.mechanic_name,
      assigned_mechanic_contact: mechanic.number,
      complaint_status: 'assigned_to_mechanic',
      mechanic_assigned_datetime: now,
      updated_at: now,
    };
    if (paymentAmount !== null) updateLeadPayload.payment_to_mechanic = paymentAmount;
    if (remark) updateLeadPayload.assigned_remark = remark;

    const { error: updError } = await (supabaseAdmin as any)
      .from('rsa_leads')
      .update(updateLeadPayload)
      .eq('id', leadId);
    if (updError) return NextResponse.json({ error: 'Failed to assign mechanic', details: updError.message }, { status: 500 });

    // Timeline entry
    try {
      await (supabaseAdmin as any)
        .from('rsa_lead_timeline')
        .insert({
          lead_id: leadId,
          status: prevMechanicId ? 'mechanic_changed' : 'assigned_to_mechanic',
          status_description: prevMechanicId
            ? `Mechanic changed to ${mechanic.mechanic_name}`
            : `Mechanic ${mechanic.mechanic_name} assigned`,
          updated_by_id: user.id,
          updated_by_name: String((userProfile as any)?.full_name || (userProfile as any)?.name || user.email || '').trim() || null,
          updated_at: now,
          created_at: now,
        });
    } catch {
      // ignore timeline errors
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}

