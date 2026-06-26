import {
  mapMembershipTermRow,
  MEMBERSHIP_TERMS_TABLE,
  MIGRATION_227_HINT,
  migrationHintForMembershipTermsError,
} from '@/lib/membership-terms-db';
import {
  membershipTermBulkToInsert,
  normalizeMembershipTermBulkInput,
  type MembershipTermBulkUpdate,
} from '@/lib/membership-terms-admin';
import { normalizeMembershipType } from '@/lib/membership-placements';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { createClient } from '@/lib/supabase/server';
import { requireSuperAdmin } from '@/lib/super-admin-auth';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const MAX_BULK = 200;

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

function buildVisibilityUpdate(row: {
  visible_android: boolean;
  visible_ios: boolean;
  visible_web: boolean;
}) {
  const visibleApp = row.visible_android || row.visible_ios;
  return {
    visible_android: row.visible_android,
    visible_ios: row.visible_ios,
    visible_web: row.visible_web,
    visible_app: visibleApp,
    active: visibleApp || row.visible_web,
    updated_at: new Date().toISOString(),
  };
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = await requireSuperAdmin(supabase);
    if (!auth.ok) return auth.res;

    const { db, res: dbErr } = await getAdminDb();
    if (!db) return dbErr!;

    const body = await request.json().catch(() => ({}));
    const membershipType = normalizeMembershipType(body?.membership_type);
    const rawRows = Array.isArray(body?.terms) ? body.terms : [];
    if (rawRows.length === 0) {
      return NextResponse.json({ error: 'No terms provided for bulk upload' }, { status: 400 });
    }
    if (rawRows.length > MAX_BULK) {
      return NextResponse.json({ error: `Maximum ${MAX_BULK} terms per bulk upload` }, { status: 400 });
    }

    const rows = [];
    const errors: string[] = [];
    rawRows.forEach((raw: Record<string, unknown>, index: number) => {
      const normalized = normalizeMembershipTermBulkInput(raw, index + 1);
      if (!normalized) {
        errors.push(`Row ${index + 1}: body is required.`);
        return;
      }
      rows.push(membershipTermBulkToInsert(normalized, membershipType));
    });

    if (rows.length === 0) {
      return NextResponse.json({ error: 'No valid terms to import', errors }, { status: 400 });
    }

    const { data, error } = await db.from(MEMBERSHIP_TERMS_TABLE).insert(rows).select('id');
    if (error) {
      return NextResponse.json(
        {
          error: 'Failed to bulk import terms',
          details: error.message,
          hint: migrationHintForMembershipTermsError(error.message) || MIGRATION_227_HINT,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      imported: data?.length || rows.length,
      skipped: errors.length,
      errors,
      message: `Imported ${data?.length || rows.length} term(s)`,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = await requireSuperAdmin(supabase);
    if (!auth.ok) return auth.res;

    const { db, res: dbErr } = await getAdminDb();
    if (!db) return dbErr!;

    const body = await request.json().catch(() => ({}));
    const updates = Array.isArray(body?.updates) ? (body.updates as MembershipTermBulkUpdate[]) : [];
    const ids = Array.isArray(body?.ids) ? body.ids.map(String).filter(Boolean) : [];
    const patch = body?.patch && typeof body.patch === 'object' ? body.patch : null;

    if (updates.length > 0) {
      if (updates.length > MAX_BULK) {
        return NextResponse.json({ error: `Maximum ${MAX_BULK} rows per bulk edit` }, { status: 400 });
      }

      let updated = 0;
      const errors: string[] = [];
      for (const row of updates) {
        const id = String(row.id || '').trim();
        if (!id) {
          errors.push('Missing id in update row.');
          continue;
        }

        const { data: existing, error: fetchError } = await db
          .from(MEMBERSHIP_TERMS_TABLE)
          .select('*')
          .eq('id', id)
          .maybeSingle();
        if (fetchError || !existing) {
          errors.push(`${id}: not found.`);
          continue;
        }

        const mapped = mapMembershipTermRow(existing);
        const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (row.body) payload.body = row.body;
        if (Number.isFinite(row.display_order)) payload.display_order = row.display_order;

        const hasVisibilityPatch =
          row.visible_android !== undefined ||
          row.visible_ios !== undefined ||
          row.visible_web !== undefined;
        if (hasVisibilityPatch) {
          Object.assign(
            payload,
            buildVisibilityUpdate({
              visible_android: row.visible_android ?? mapped.visible_android,
              visible_ios: row.visible_ios ?? mapped.visible_ios,
              visible_web: row.visible_web ?? mapped.visible_web,
            }),
          );
        }

        const { error } = await db.from(MEMBERSHIP_TERMS_TABLE).update(payload).eq('id', id);
        if (error) {
          errors.push(`${id}: ${error.message}`);
          continue;
        }
        updated += 1;
      }

      return NextResponse.json({
        success: true,
        updated,
        errors,
        message: `Updated ${updated} term(s)`,
      });
    }

    if (ids.length === 0) {
      return NextResponse.json({ error: 'No ids or updates provided for bulk edit' }, { status: 400 });
    }
    if (ids.length > MAX_BULK) {
      return NextResponse.json({ error: `Maximum ${MAX_BULK} ids per bulk edit` }, { status: 400 });
    }
    if (!patch) {
      return NextResponse.json({ error: 'patch object is required for visibility bulk edit' }, { status: 400 });
    }

    const { data: existing, error: fetchError } = await db
      .from(MEMBERSHIP_TERMS_TABLE)
      .select('*')
      .in('id', ids);
    if (fetchError) {
      return NextResponse.json({ error: 'Failed to load terms', details: fetchError.message }, { status: 500 });
    }

    let updated = 0;
    for (const row of existing || []) {
      const mapped = mapMembershipTermRow(row);
      const next = {
        visible_android:
          patch.visible_android !== undefined ? !!patch.visible_android : mapped.visible_android,
        visible_ios: patch.visible_ios !== undefined ? !!patch.visible_ios : mapped.visible_ios,
        visible_web: patch.visible_web !== undefined ? !!patch.visible_web : mapped.visible_web,
      };
      const { error } = await db
        .from(MEMBERSHIP_TERMS_TABLE)
        .update(buildVisibilityUpdate(next))
        .eq('id', mapped.id);
      if (!error) updated += 1;
    }

    return NextResponse.json({
      success: true,
      updated,
      message: `Updated visibility for ${updated} term(s)`,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = await requireSuperAdmin(supabase);
    if (!auth.ok) return auth.res;

    const { db, res: dbErr } = await getAdminDb();
    if (!db) return dbErr!;

    const body = await request.json().catch(() => ({}));
    const ids = Array.isArray(body?.ids) ? body.ids.map(String).filter(Boolean) : [];
    if (ids.length === 0) {
      return NextResponse.json({ error: 'No ids provided for bulk delete' }, { status: 400 });
    }
    if (ids.length > MAX_BULK) {
      return NextResponse.json({ error: `Maximum ${MAX_BULK} ids per bulk delete` }, { status: 400 });
    }

    const { error } = await db.from(MEMBERSHIP_TERMS_TABLE).delete().in('id', ids);
    if (error) {
      return NextResponse.json({ error: 'Failed to bulk delete terms', details: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      deleted: ids.length,
      message: `Deleted ${ids.length} term(s)`,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 });
  }
}
