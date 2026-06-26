import {
  buildPublicFaqInsert,
  mapPublicFaqRow,
  migrationHintForPublicFaqsError,
  MIGRATION_229_HINT,
  PUBLIC_FAQS_TABLE,
  sortPublicFaqs,
} from '@/lib/public-faqs-db';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { createClient } from '@/lib/supabase/server';
import { requireSuperAdmin } from '@/lib/super-admin-auth';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

async function getAdminDb() {
  const { supabaseAdmin, error } = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return {
      db: null,
      res: NextResponse.json({ error: 'Database not configured', details: error }, { status: 500 }),
    };
  }
  return { db: supabaseAdmin, res: null };
}

export async function GET() {
  try {
    const supabase = await createClient();
    const auth = await requireSuperAdmin(supabase);
    if (!auth.ok) return auth.res;

    const { db, res: dbErr } = await getAdminDb();
    if (!db) return dbErr!;

    const { data, error } = await db
      .from(PUBLIC_FAQS_TABLE)
      .select('*')
      .order('faq_group', { ascending: true })
      .order('section_key', { ascending: true })
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json(
        {
          error: 'Failed to fetch FAQs',
          details: error.message,
          hint: migrationHintForPublicFaqsError(error.message) || MIGRATION_229_HINT,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ data: sortPublicFaqs((data || []).map(mapPublicFaqRow)) });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = await requireSuperAdmin(supabase);
    if (!auth.ok) return auth.res;

    const { db, res: dbErr } = await getAdminDb();
    if (!db) return dbErr!;

    const body = await request.json();
    const payload = buildPublicFaqInsert(body);
    if (!payload.question || !payload.answer) {
      return NextResponse.json({ error: 'Question and answer are required' }, { status: 400 });
    }

    const { data, error } = await db.from(PUBLIC_FAQS_TABLE).insert(payload).select('*').single();
    if (error) {
      return NextResponse.json(
        {
          error: 'Failed to create FAQ',
          details: error.message,
          hint: migrationHintForPublicFaqsError(error.message) || MIGRATION_229_HINT,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ data: mapPublicFaqRow(data) });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 });
  }
}
