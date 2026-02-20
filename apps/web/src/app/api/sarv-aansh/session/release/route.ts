import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { assertEligibleUser } from '@/lib/sarvAanshSession';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  let profileId: string;
  try {
    const supabase = await createClient();
    const { profile } = await assertEligibleUser(supabase);
    profileId = profile.id;
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

  const db = supabaseAdmin as any;
  const now = new Date().toISOString();

  let body: { session_token?: string };
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    body = {};
  }
  const sessionToken = typeof body?.session_token === 'string' ? body.session_token.trim() : null;

  if (sessionToken) {
    const { data, error } = await db
      .from('sarv_aansh_sessions')
      .update({ released_at: now })
      .eq('session_token', sessionToken)
      .eq('user_id', profileId)
      .is('released_at', null)
      .select('id')
      .maybeSingle();
    if (error || !data) {
      return NextResponse.json(
        { error: 'Session not found or already released' },
        { status: 404 }
      );
    }
  } else {
    await db
      .from('sarv_aansh_sessions')
      .update({ released_at: now })
      .eq('user_id', profileId)
      .is('released_at', null);
  }

  return NextResponse.json({ ok: true });
}
