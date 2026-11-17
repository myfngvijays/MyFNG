import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export const dynamic = 'force-dynamic';

async function profileId(supabase: any, user: { id: string; email?: string | null; phone?: string | null }) {
  const email = String(user.email || '').trim();
  const phone = String(user.phone || '').trim();
  const { data: byId } = await supabase.from('users_login').select('id').eq('id', user.id).maybeSingle();
  if (byId?.id) return String(byId.id);
  if (email) {
    const { data } = await supabase.from('users_login').select('id').ilike('email', email).maybeSingle();
    if (data?.id) return String(data.id);
  }
  if (phone) {
    const { data } = await supabase.from('users_login').select('id').eq('phone', phone).maybeSingle();
    if (data?.id) return String(data.id);
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClientFromRequest(request);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const ownerId = await profileId(supabase, user);
    if (!ownerId) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const { supabaseAdmin } = getSupabaseAdmin();
    const db: any = supabaseAdmin || supabase;
    const now = new Date().toISOString();

    if (body?.all) {
      const { error } = await db
        .from('notifications')
        .update({ is_read: true, read_at: now })
        .eq('user_id', ownerId)
        .eq('is_read', false);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ ok: true });
    }

    const id = String(body?.id || '').trim();
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const { data: row } = await db.from('notifications').select('id, user_id').eq('id', id).maybeSingle();
    if (!row || String(row.user_id) !== ownerId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const { error } = await db.from('notifications').update({ is_read: true, read_at: now }).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 });
  }
}
