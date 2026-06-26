import { createClient } from '@/lib/supabase/server';

export type PushAdminAuth =
  | { ok: false; status: number; error: string }
  | { ok: true; userId: string; userName: string; roleCode: string };

export async function assertPushAdmin(): Promise<PushAdminAuth> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }

  const { data: userData } = await supabase
    .from('users_login')
    .select('id, full_name, roles!inner(role_code)')
    .eq('id', user.id)
    .single();

  const roleCode = (userData as { roles?: { role_code?: string } } | null)?.roles?.role_code || '';
  if (!['SUPER_ADMIN', 'SUB_ADMIN'].includes(roleCode)) {
    return { ok: false, status: 403, error: 'Forbidden' };
  }

  return {
    ok: true,
    userId: user.id,
    userName: (userData as { full_name?: string } | null)?.full_name || user.email || 'Admin',
    roleCode,
  };
}
