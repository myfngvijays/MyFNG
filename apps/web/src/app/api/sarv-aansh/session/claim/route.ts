import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { assertEligibleUser, nextExpiresAt } from '@/lib/sarvAanshSession';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  let profileId: string;
  let roleCode: string;
  try {
    const supabase = await createClient();
    const { profile, roleCode: rc } = await assertEligibleUser(supabase);
    profileId = profile.id;
    roleCode = rc;
  } catch (e: any) {
    const status = e?.status ?? 500;
    return NextResponse.json(
      { error: e?.error ?? 'Unauthorized' },
      { status: typeof status === 'number' ? status : 500 }
    );
  }

  const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
  if (!supabaseAdmin || adminError) {
    return NextResponse.json(
      { error: adminError ?? 'Server configuration error' },
      { status: 500 }
    );
  }

  let body: { aansh_id?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const aanshId = body?.aansh_id != null ? Number(body.aansh_id) : NaN;
  if (!Number.isFinite(aanshId) || aanshId < 0) {
    return NextResponse.json({ error: 'aansh_id required and must be a non-negative number' }, { status: 400 });
  }

  const db = supabaseAdmin as any;
  const now = new Date().toISOString();

  const { data: catalogRow } = await db
    .from('sarv_aansh_catalog')
    .select('aansh_id')
    .eq('aansh_id', aanshId)
    .eq('is_active', true)
    .maybeSingle();
  if (!catalogRow) {
    return NextResponse.json({ error: 'Aansh ID not available or not in catalog' }, { status: 400 });
  }

  await db
    .from('sarv_aansh_sessions')
    .update({ released_at: now })
    .eq('user_id', profileId)
    .is('released_at', null);

  const expiresAt = nextExpiresAt();
  const { data: inserted, error: insertError } = await db
    .from('sarv_aansh_sessions')
    .insert({
      aansh_id: aanshId,
      user_id: profileId,
      assignee_role: roleCode,
      expires_at: expiresAt,
    })
    .select('session_token, expires_at, aansh_id')
    .single();

  if (insertError) {
    if (insertError.code === '23505') {
      return NextResponse.json({ error: 'Aansh ID already claimed by another user' }, { status: 409 });
    }
    return NextResponse.json({ error: insertError.message ?? 'Claim failed' }, { status: 500 });
  }

  return NextResponse.json({
    session_token: inserted.session_token,
    expires_at: inserted.expires_at,
    aansh_id: inserted.aansh_id,
  });
}
