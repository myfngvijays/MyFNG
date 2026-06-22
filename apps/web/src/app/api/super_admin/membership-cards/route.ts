import {
  buildMembershipCardPayload,
  migrationHintForCardError,
  sortMembershipCards,
} from '@/lib/membership-cards-db';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { createClient } from '@/lib/supabase/server';
import { requireSuperAdmin } from '@/lib/super-admin-auth';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const TABLE = 'membership_cards';

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

    const { data, error } = await db.from(TABLE).select('*').order('display_order', { ascending: true });

    if (error) {
      const hint = migrationHintForCardError(error.message);
      return NextResponse.json({ error: 'Failed to fetch cards', details: error.message, hint }, { status: 500 });
    }

    return NextResponse.json({ data: sortMembershipCards(data || []) });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
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
    const title = String(body.title || '').trim();
    if (!title) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }

    const payload = buildMembershipCardPayload(body);
    const { data, error } = await db.from(TABLE).insert(payload).select().single();

    if (error) {
      const hint = migrationHintForCardError(error.message);
      return NextResponse.json({ error: 'Failed to create card', details: error.message, hint }, { status: 500 });
    }
    return NextResponse.json({ data, message: 'Card created successfully' });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}
