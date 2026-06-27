import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import {
  getSmartToolsHandlerConfig,
  migrationHintForSmartToolsError,
  normalizeSmartToolsHandlerConfig,
  saveSmartToolsHandlerConfig,
} from '@/lib/smart-tools-config';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

async function assertSuperAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { ok: false as const, status: 401, error: 'Unauthorized', user: null };
  }

  const { data: userData, error: roleError } = await supabase
    .from('users_login')
    .select('id, roles!inner(role_code)')
    .eq('id', user.id)
    .single();

  if (roleError || !userData) {
    return { ok: false as const, status: 403, error: 'Forbidden - Role check failed', user: null };
  }

  const roleCode = (userData as any).roles?.role_code;
  if (!['SUPER_ADMIN', 'SUB_ADMIN'].includes(roleCode)) {
    return { ok: false as const, status: 403, error: 'Forbidden - Not super admin', user: null };
  }

  return { ok: true as const, status: 200, error: null, user };
}

export async function GET() {
  try {
    const auth = await assertSuperAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: adminError || 'Admin client not configured' }, { status: 500 });
    }

    const config = await getSmartToolsHandlerConfig(supabaseAdmin);
    return NextResponse.json({ success: true, config });
  } catch (e: any) {
    const hint = migrationHintForSmartToolsError(e?.message);
    return NextResponse.json(
      { error: e?.message || 'Internal server error', hint },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await assertSuperAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: adminError || 'Admin client not configured' }, { status: 500 });
    }

    const body = await request.json().catch(() => ({}));
    const saved = await saveSmartToolsHandlerConfig(
      supabaseAdmin,
      normalizeSmartToolsHandlerConfig(body?.config || body),
      auth.user?.id || null,
    );

    return NextResponse.json({
      success: true,
      config: saved,
      message: 'Smart Tools settings saved',
    });
  } catch (e: any) {
    const hint = migrationHintForSmartToolsError(e?.message);
    return NextResponse.json(
      { error: e?.message || 'Internal server error', hint },
      { status: 500 },
    );
  }
}
