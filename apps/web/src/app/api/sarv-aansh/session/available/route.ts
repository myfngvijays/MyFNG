import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { assertEligibleUser } from '@/lib/sarvAanshSession';

export const dynamic = 'force-dynamic';

export async function GET() {
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

  const [catalogRes, activeRes, mySessionRes] = await Promise.all([
    db.from('sarv_aansh_catalog').select('aansh_id, system_name').eq('is_active', true),
    db
      .from('sarv_aansh_sessions')
      .select('aansh_id')
      .is('released_at', null)
      .gt('expires_at', now),
    db
      .from('sarv_aansh_sessions')
      .select('aansh_id, session_token, expires_at')
      .is('released_at', null)
      .gt('expires_at', now)
      .eq('user_id', profileId)
      .maybeSingle(),
  ]);

  const catalogRows = Array.isArray(catalogRes.data) ? catalogRes.data : [];
  const catalogById = new Map(catalogRows.map((r: any) => [r.aansh_id, { aansh_id: r.aansh_id, system_name: r.system_name || null }]));
  const heldIds = new Set(
    (Array.isArray(activeRes.data) ? activeRes.data : []).map((r: any) => r.aansh_id)
  );
  const available = Array.from(catalogById.keys())
    .filter((id) => !heldIds.has(id))
    .sort((a, b) => Number(a) - Number(b))
    .map((aansh_id) => ({
      aansh_id,
      system_name: catalogById.get(aansh_id)?.system_name ?? null,
    }));

  const myRow = mySessionRes.data as any;
  const currentSession =
    myRow && myRow.expires_at > now
      ? {
          aansh_id: myRow.aansh_id,
          session_token: myRow.session_token,
          expires_at: myRow.expires_at,
        }
      : null;

  return NextResponse.json({ available, currentSession });
}
