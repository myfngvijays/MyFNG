import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import {
  crmSeesAllLeads,
  isTelecallerCrmRole,
  normalizeRoleCode,
} from '@/lib/telecaller/crmRoles';

export type CrmReportsContext = {
  db: any;
  teleCallerId: string;
  roleCode: string;
  seesAll: boolean;
};

export async function requireCrmReportsContext(
  request: NextRequest,
): Promise<CrmReportsContext | NextResponse> {
  const supabase = await createClientFromRequest(request);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const profile = await resolveUserProfile(supabase, user);
  const teleCallerId = String(profile?.id || '').trim();
  if (!teleCallerId) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  const roleCode = normalizeRoleCode(
    (profile as { roles?: { role_code?: string } })?.roles?.role_code,
  );
  if (!isTelecallerCrmRole(roleCode)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { supabaseAdmin } = getSupabaseAdmin();
  return {
    db: (supabaseAdmin ?? supabase) as any,
    teleCallerId,
    roleCode,
    seesAll: crmSeesAllLeads(roleCode),
  };
}

export function isNextResponse(v: unknown): v is NextResponse {
  return v instanceof NextResponse;
}
