import { createClient } from '@/lib/supabase/server';

export const ALLOWED_ADMIN_ROLES = ['SUPER_ADMIN', 'SUB_ADMIN'];

export async function getDbWithAdmin() {
  const supabase = await createClient();
  const db: any = supabase;

  const {
    data: { user },
    error: authError,
  } = await db.auth.getUser();

  if (authError || !user) {
    return { ok: false, status: 401, error: 'Unauthorized', db, userProfile: null };
  }

  const { data: userProfile } = await db
    .from('users_login')
    .select('id, full_name, roles!inner(role_code)')
    .eq('id', user.id)
    .maybeSingle();

  const roleCode = (userProfile as any)?.roles?.role_code;
  if (!userProfile || !ALLOWED_ADMIN_ROLES.includes(roleCode)) {
    return { ok: false, status: 403, error: 'Forbidden', db, userProfile: null };
  }

  return { ok: true, status: 200, error: null, db, userProfile };
}

export async function getLatestFlowVersion(db: any, botFlowId: string) {
  const { data } = await db
    .from('bot_flow_versions')
    .select('*')
    .eq('bot_flow_id', botFlowId)
    .order('version_no', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data || null;
}
