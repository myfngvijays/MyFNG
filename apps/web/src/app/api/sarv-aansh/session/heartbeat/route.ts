import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { nextExpiresAt } from '@/lib/sarvAanshSession';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  let profileId: string;
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    profileId = user.id;
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

  let body: { session_token?: string };
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    body = {};
  }
  const sessionToken = typeof body?.session_token === 'string' ? body.session_token.trim() : null;
  if (!sessionToken) {
    return NextResponse.json({ error: 'session_token required' }, { status: 400 });
  }

  const db = supabaseAdmin as any;
  const expiresAt = nextExpiresAt();

  const { data: row, error: updateError } = await db
    .from('sarv_aansh_sessions')
    .update({ expires_at: expiresAt })
    .eq('session_token', sessionToken)
    .eq('user_id', profileId)
    .is('released_at', null)
    .select('expires_at')
    .single();

  if (updateError || !row) {
    return NextResponse.json(
      { error: 'Session not found or expired' },
      { status: 404 }
    );
  }

  return NextResponse.json({ expires_at: row.expires_at });
}
