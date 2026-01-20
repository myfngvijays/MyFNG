import type { SupabaseClient } from '@supabase/supabase-js';

export async function resolveUserProfile(
  supabase: SupabaseClient,
  user: { id: string; email?: string | null; phone?: string | null }
) {
  const email = (user.email || '').trim();
  const phone = (user.phone || '').trim();
  const selectProfile = 'id, email, phone, roles!role_id(role_code), full_name';

  const { data: byEmail } = email
    ? await supabase.from('users_login').select(selectProfile).ilike('email', email).maybeSingle()
    : { data: null as any };
  const { data: byPhone } = !byEmail && phone
    ? await supabase.from('users_login').select(selectProfile).eq('phone', phone).maybeSingle()
    : { data: null as any };
  const { data: byId } = !byEmail && !byPhone
    ? await supabase.from('users_login').select(selectProfile).eq('id', user.id).maybeSingle()
    : { data: null as any };
  return byEmail || byPhone || byId;
}

