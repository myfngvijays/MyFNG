import { createClient } from '@/lib/supabase/server';

export type AdminAuthResult =
  | { ok: true; userId: string }
  | { ok: false; status: number; error: string };

export async function assertSuperAdminAccess(): Promise<AdminAuthResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }

  const { data: userData, error: roleError } = await supabase
    .from('users_login')
    .select('id, roles!inner(role_code)')
    .eq('id', user.id)
    .single();

  if (roleError || !userData) {
    return { ok: false, status: 403, error: 'Forbidden - Role check failed' };
  }

  const roleCode = String((userData as any)?.roles?.role_code || '');
  if (!['SUPER_ADMIN', 'SUB_ADMIN'].includes(roleCode)) {
    return { ok: false, status: 403, error: 'Forbidden - Super admin only' };
  }

  return { ok: true, userId: String(user.id) };
}

