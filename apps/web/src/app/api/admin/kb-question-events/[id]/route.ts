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

// PATCH: update kb_question_events fields (status/notes/answer) (service_role write, SUPER_ADMIN gated)
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const gate = await requireSuperAdmin(supabase);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const { db, error: adminErr } = getAdminDb();
    if (!db) return NextResponse.json({ error: adminErr }, { status: 500 });

    const { id: rawId } = await params;
    const id = String(rawId || '').trim();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const body = await request.json().catch(() => null) as any;
    const patch: any = {};
    if (typeof body?.status === 'string') patch.status = body.status;
    if (typeof body?.triage_notes === 'string') patch.triage_notes = body.triage_notes;
    if (typeof body?.resolved_answer === 'string') patch.resolved_answer = body.resolved_answer;
    patch.updated_at = new Date().toISOString();

    const { data, error } = await db
      .from('kb_question_events')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;

    return NextResponse.json({ ok: true, item: data });
  } catch (error: any) {
    console.error('[admin/kb-question-events][PATCH]', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}


