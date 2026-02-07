import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const callId = String(id || '').trim();
    if (!callId) return NextResponse.json({ error: 'Missing call id' }, { status: 400 });

    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    const user = authData?.user || null;
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await resolveUserProfile(supabase, user);
    if (!profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const roleCode = String((profile.roles as any)?.role_code || '');
    const allowed = new Set(['TELECALLER', 'RSA_MANAGER', 'SUPER_ADMIN', 'SUB_ADMIN']);
    if (!allowed.has(roleCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: adminError || 'Admin client not configured' }, { status: 500 });
    }
    const db = supabaseAdmin as any;

    const { data: callRow, error: callError } = await db
      .from('sarv_calls')
      .select('id, assigned_user_id')
      .eq('id', callId)
      .single();

    if (callError || !callRow?.id) {
      return NextResponse.json({ error: 'Call not found' }, { status: 404 });
    }

    // Agents can only view audit for calls assigned to them.
    if (['TELECALLER', 'RSA_MANAGER'].includes(roleCode) && String(callRow.assigned_user_id) !== String(profile.id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: audit, error: auditError } = await db
      .from('sarv_call_audits')
      .select('id, sarv_call_id, audit_status, audit_score, feedback, audited_by_id, audited_at, updated_at, created_at')
      .eq('sarv_call_id', callId)
      .maybeSingle();

    if (auditError) {
      return NextResponse.json({ error: 'Failed to load audit' }, { status: 500 });
    }

    return NextResponse.json({ audit: audit || null });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}

