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

// POST: upsert into kb_manual_faqs + mark kb_question_events as added_to_kb
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const gate = await requireSuperAdmin(supabase);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const { db, error: adminErr } = getAdminDb();
    if (!db) return NextResponse.json({ error: adminErr }, { status: 500 });

    const { id: rawId } = await params;
    const id = String(rawId || '').trim();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const { data: ev, error: evErr } = await db
      .from('kb_question_events')
      .select('*')
      .eq('id', id)
      .single();
    if (evErr || !ev) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    const question = String((ev as any).user_message || '').trim();
    const answer = String((ev as any).resolved_answer || '').trim();
    if (!question) return NextResponse.json({ error: 'Missing user_message' }, { status: 400 });
    if (!answer) return NextResponse.json({ error: 'resolved_answer is required before adding to KB' }, { status: 400 });

    const now = new Date().toISOString();

    // Upsert curated FAQ (unique by question)
    const { data: faq, error: faqErr } = await db
      .from('kb_manual_faqs')
      .upsert(
        {
          question,
          answer,
          is_active: true,
          source_event_id: id,
          updated_at: now,
        },
        { onConflict: 'question' }
      )
      .select('*')
      .single();
    if (faqErr) throw faqErr;

    const triageNotes = String((ev as any).triage_notes || '').trim();
    const mergedNotes = [triageNotes, `added_to_kb:${now}`].filter(Boolean).join('\n');

    const { data: updated, error: upErr } = await db
      .from('kb_question_events')
      .update({ status: 'added_to_kb', triage_notes: mergedNotes, updated_at: now })
      .eq('id', id)
      .select('*')
      .single();
    if (upErr) throw upErr;

    return NextResponse.json({ ok: true, faq, item: updated });
  } catch (error: any) {
    console.error('[admin/kb-question-events/add-to-kb][POST]', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}


