import type { SupabaseClient } from '@supabase/supabase-js';

export async function resolveUserProfile(
  supabase: SupabaseClient,
  user: { id: string; email?: string | null; phone?: string | null },
  db?: SupabaseClient | null,
) {
  const client = (db || supabase) as SupabaseClient;
  const email = (user.email || '').trim();
  const phone = (user.phone || '').trim();
  const selectProfile = 'id, email, phone, roles!role_id(role_code), full_name';

  const { data: byId } = await client
    .from('users_login')
    .select(selectProfile)
    .eq('id', user.id)
    .maybeSingle();
  if (byId) return byId;

  const [byEmailRes, byPhoneRes] = await Promise.all([
    email ? client.from('users_login').select(selectProfile).ilike('email', email).maybeSingle() : { data: null },
    phone ? client.from('users_login').select(selectProfile).eq('phone', phone).maybeSingle() : { data: null },
  ]);
  return byEmailRes.data || byPhoneRes.data || null;
}

