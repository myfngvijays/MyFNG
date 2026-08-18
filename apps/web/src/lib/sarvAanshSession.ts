import type { SupabaseClient } from '@supabase/supabase-js';

const ELIGIBLE_ROLES = new Set(['TELECALLER', 'RSA_MANAGER', 'LEAD_MANAGER']);
const SESSION_TTL_SECONDS = 120;

export { SESSION_TTL_SECONDS };

export type EligibleProfile = {
  id: string;
  email?: string | null;
  phone?: string | null;
  full_name?: string | null;
  roles: { role_code: string };
};

export async function assertEligibleUser(supabase: SupabaseClient): Promise<{
  user: { id: string; email?: string | null; phone?: string | null };
  profile: EligibleProfile;
  roleCode: string;
}> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    throw { status: 401, error: 'Unauthorized' };
  }
  const selectProfile = 'id, email, phone, full_name, roles!inner(role_code)';
  const email = (user.email || '').trim();
  const phone = (user.phone || '').trim();

  const { data: byEmail } = email
    ? await supabase.from('users_login').select(selectProfile).ilike('email', email).maybeSingle()
    : { data: null as any };
  const { data: byPhone } = !byEmail && phone
    ? await supabase.from('users_login').select(selectProfile).eq('phone', phone).maybeSingle()
    : { data: null as any };
  const { data: byId } = !byEmail && !byPhone
    ? await supabase.from('users_login').select(selectProfile).eq('id', user.id).maybeSingle()
    : { data: null as any };

  const profile = (byEmail || byPhone || byId) as EligibleProfile | null;
  if (!profile) {
    throw { status: 404, error: 'User profile not found' };
  }
  const roleCode = String((profile.roles as any)?.role_code || '');
  if (!ELIGIBLE_ROLES.has(roleCode)) {
    throw { status: 403, error: 'Forbidden: TELECALLER, LEAD_MANAGER or RSA_MANAGER only' };
  }
  return { user, profile, roleCode };
}

export function nextExpiresAt(): string {
  const d = new Date();
  d.setSeconds(d.getSeconds() + SESSION_TTL_SECONDS);
  return d.toISOString();
}
