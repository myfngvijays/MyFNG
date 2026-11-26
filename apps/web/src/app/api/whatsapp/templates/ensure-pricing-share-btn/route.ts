import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ensurePricingShareButtonTemplateOnMeta } from '@/lib/services/ensurePricingShareButtonTemplate';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED_ADMIN_ROLES = ['SUPER_ADMIN', 'SUB_ADMIN'];

async function assertAdmin(db: any) {
  const {
    data: { user },
    error: authError,
  } = await db.auth.getUser();
  if (authError || !user) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }

  const { data: userProfile } = await db
    .from('users_login')
    .select('id, roles!inner(role_code)')
    .eq('id', user.id)
    .maybeSingle();

  const roleCode = (userProfile as { roles?: { role_code?: string } })?.roles?.role_code;
  if (!userProfile || !ALLOWED_ADMIN_ROLES.includes(String(roleCode || ''))) {
    return { ok: false, status: 403, error: 'Forbidden' };
  }
  return { ok: true };
}

/** Upsert `pricing_share_link_btn` locally + submit to current Meta WABA (6161 / env). */
export async function POST() {
  try {
    const supabase = await createClient();
    const auth = await assertAdmin(supabase);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const result = await ensurePricingShareButtonTemplateOnMeta();
    if (!result.success) {
      return NextResponse.json(
        { error: result.message, templateId: result.templateId, wabaResults: result.wabaResults },
        { status: 502 },
      );
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: String((error as { message?: string })?.message || 'Internal server error') },
      { status: 500 },
    );
  }
}