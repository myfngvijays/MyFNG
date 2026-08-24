import { NextResponse } from 'next/server';

export const PANEL_ACCESS_ROLES = {
  bookings: ['SUPER_ADMIN', 'SUB_ADMIN', 'LEAD_MANAGER', 'APP_OPERATIONS'],
  appCustomers: ['SUPER_ADMIN', 'SUB_ADMIN', 'LEAD_MANAGER', 'APP_OPERATIONS'],
  referral: ['SUPER_ADMIN', 'SUB_ADMIN', 'LEAD_MANAGER', 'APP_OPERATIONS'],
} as const;

export type AdminPanel = keyof typeof PANEL_ACCESS_ROLES;

type AuthOk = { ok: true; user: { id: string }; roleCode: string };
type AuthFail = { ok: false; res: NextResponse };

async function resolveAdminRole(supabase: any): Promise<AuthOk | AuthFail> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { ok: false, res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const { data: userData, error: roleError } = await supabase
    .from('users_login')
    .select('id, roles!inner(role_code)')
    .eq('id', user.id)
    .single();

  if (roleError || !userData) {
    return { ok: false, res: NextResponse.json({ error: 'Forbidden - Role check failed' }, { status: 403 }) };
  }

  const roleCode = String((userData as any).roles?.role_code || '');
  return { ok: true, user: { id: user.id }, roleCode };
}

export async function requireRoleCodes(supabase: any, allowedRoles: readonly string[]): Promise<AuthOk | AuthFail> {
  const auth = await resolveAdminRole(supabase);
  if (!auth.ok) return auth;
  if (!allowedRoles.includes(auth.roleCode)) {
    return { ok: false, res: NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 }) };
  }
  return auth;
}

export async function requirePanelAccess(supabase: any, panel: AdminPanel): Promise<AuthOk | AuthFail> {
  return requireRoleCodes(supabase, PANEL_ACCESS_ROLES[panel]);
}

/** Full Super Admin only — unchanged behaviour for sensitive routes. */
export async function requireSuperAdmin(supabase: any): Promise<AuthOk | AuthFail> {
  return requireRoleCodes(supabase, ['SUPER_ADMIN']);
}

/** Legacy helper shape used by some booking/customer routes. */
export async function assertPanelAccessLegacy(
  supabase: any,
  panel: AdminPanel,
): Promise<{ ok: boolean; status: number; error: string | null }> {
  const auth = await requirePanelAccess(supabase, panel);
  if (!auth.ok) {
    const status = auth.res.status || 403;
    let error = 'Forbidden';
    try {
      const body = await auth.res.clone().json();
      error = body?.error || error;
    } catch {
      // ignore
    }
    return { ok: false, status, error };
  }
  return { ok: true, status: 200, error: null };
}
