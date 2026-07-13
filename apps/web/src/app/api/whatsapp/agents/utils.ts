import { createClient } from '@/lib/supabase/server';
import type { AgentType } from '@/lib/whatsappAgents/shared/types';

export const ALLOWED_ADMIN_ROLES = ['SUPER_ADMIN', 'SUB_ADMIN'];
export const AGENT_TYPES: AgentType[] = ['BOOKING', 'FOLLOWUP', 'CHASE'];

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

export function parseAgentType(value: string): AgentType | null {
  const upper = value.trim().toUpperCase();
  return AGENT_TYPES.includes(upper as AgentType) ? (upper as AgentType) : null;
}
