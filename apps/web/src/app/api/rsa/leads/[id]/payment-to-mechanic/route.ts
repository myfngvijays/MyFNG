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
    const amount = parseAmount(body?.payment_to_mechanic);
    if (amount != null && amount < 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: adminError || 'Admin client not configured' }, { status: 500 });
    }

    // If RSA_MANAGER, allow editing only if lead is assigned to them
    if (roleCode === 'RSA_MANAGER') {
      const { data: leadRow, error: leadErr } = await (supabaseAdmin as any)
        .from('rsa_leads')
        .select('id, assigned_manager_id')
        .eq('id', leadId)
        .single();
      if (leadErr) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
      if (String(leadRow?.assigned_manager_id || '') !== String(user.id)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const now = new Date().toISOString();
    const { error } = await (supabaseAdmin as any)
      .from('rsa_leads')
      .update({ payment_to_mechanic: amount, updated_at: now } as any)
      .eq('id', leadId);

    if (error) {
      return NextResponse.json({ error: 'Failed to update mechanic amount', details: error.message }, { status: 500 });
    }

    // Best-effort timeline entry
    try {
      await (supabaseAdmin as any)
        .from('rsa_lead_timeline')
        .insert({
          lead_id: leadId,
          status: 'payment_updated',
          status_description: `Mechanic amount updated to ${amount == null ? '—' : amount}`,
          updated_by_id: user.id,
          updated_by_name: String((userProfile as any)?.full_name || (userProfile as any)?.name || user.email || '').trim() || null,
          updated_at: now,
          created_at: now,
        });
    } catch {
      // ignore timeline errors
    }

    return NextResponse.json({ success: true, payment_to_mechanic: amount }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}

