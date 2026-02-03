import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function getAdminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { db: null as any, error: 'Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL' };
  const db = createSupabaseAdminClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { db, error: null };
}

async function requireSuperAdmin(supabase: any) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { ok: false as const, status: 401, error: 'Unauthorized' };

  const { data: userRole } = await supabase
    .from('users_login')
    .select('roles(role_code)')
    .eq('id', session.user.id)
    .single();

  // @ts-ignore
  if (userRole?.roles?.role_code !== 'SUPER_ADMIN') return { ok: false as const, status: 403, error: 'Forbidden' };
  return { ok: true as const, userId: session.user.id };
}

// GET: list kb_question_events for triage (service_role read, SUPER_ADMIN gated)
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const gate = await requireSuperAdmin(supabase);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const { db, error: adminErr } = getAdminDb();
    if (!db) return NextResponse.json({ error: adminErr }, { status: 500 });

    const { searchParams } = new URL(request.url);
    const status = (searchParams.get('status') || 'new').trim();
    const q = (searchParams.get('q') || '').trim();
    const limit = Math.min(Math.max(Number(searchParams.get('limit') || 50), 1), 200);
    const offset = Math.max(Number(searchParams.get('offset') || 0), 0);

    let query = db
      .from('kb_question_events')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status && status !== 'all') query = query.eq('status', status);
    if (q) query = query.or(`user_message.ilike.%${q}%,assistant_message.ilike.%${q}%`);

    const { data, error, count } = await query;
    if (error) throw error;

    return NextResponse.json({
      items: data || [],
      count: typeof count === 'number' ? count : null,
      limit,
      offset,
    });
  } catch (error: any) {
    console.error('[admin/kb-question-events][GET]', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}


