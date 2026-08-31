import type { SupabaseClient } from '@supabase/supabase-js';

const PROFILE_SELECT = 'id, email, phone, workshop_id, role_id, full_name, roles!inner(role_code)';

export type WorkshopUserProfile = {
  id: string;
  email: string | null;
  phone: string | null;
  workshop_id: string | null;
  role_id: string | null;
  full_name: string | null;
  roles: { role_code?: string } | null;
};

/** users_login.id may differ from auth.users.id — resolve by email/phone first. */
export async function resolveWorkshopUserProfile(
  supabase: SupabaseClient,
  authUser: { id: string; email?: string | null; phone?: string | null },
): Promise<{ profile: WorkshopUserProfile | null; error?: string }> {
  const email = (authUser.email || '').trim();
  const phone = (authUser.phone || '').trim();

  if (email) {
    const { data, error } = await supabase
      .from('users_login')
      .select(PROFILE_SELECT)
      .ilike('email', email)
      .maybeSingle();
    if (data) return { profile: data as WorkshopUserProfile };
    if (error) return { profile: null, error: error.message };
  }

  if (phone) {
    const { data, error } = await supabase
      .from('users_login')
      .select(PROFILE_SELECT)
      .eq('phone', phone)
      .maybeSingle();
    if (data) return { profile: data as WorkshopUserProfile };
    if (error) return { profile: null, error: error.message };
  }

  const { data, error } = await supabase
    .from('users_login')
    .select(PROFILE_SELECT)
    .eq('id', authUser.id)
    .maybeSingle();

  if (data) return { profile: data as WorkshopUserProfile };
  return { profile: null, error: error?.message || 'Profile not found' };
}
