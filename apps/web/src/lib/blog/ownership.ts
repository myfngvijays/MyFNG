import type { SupabaseClient } from '@supabase/supabase-js';

/** True when the logged-in user created or owns the blog row. */
export function isBlogOwnedByUser(
  blog: { author_id?: string | null; created_by?: string | null },
  userId: string,
): boolean {
  if (!userId) return false;
  return blog.author_id === userId || blog.created_by === userId;
}

export function authorBlogOrFilter(userId: string) {
  return `author_id.eq.${userId},created_by.eq.${userId}`;
}

export async function fetchDigitalAuthors(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('users_login')
    .select('id, full_name, email, roles!inner(role_code)')
    .eq('roles.role_code', 'DIGITAL_AUTHOR')
    .order('full_name', { ascending: true });

  if (error) throw error;
  return (data || []).map((row) => ({
    id: String(row.id),
    full_name: String(row.full_name || row.email || 'Author'),
    email: String(row.email || ''),
  }));
}

async function isDigitalAuthorId(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase
    .from('users_login')
    .select('id, roles!inner(role_code)')
    .eq('id', userId)
    .maybeSingle();
  return (data?.roles as { role_code?: string } | null)?.role_code === 'DIGITAL_AUTHOR';
}

/** Pick blog author_id: authors always self; marketing can assign a digital author. */
export async function resolveBlogAuthorId(
  supabase: SupabaseClient,
  roleCode: string,
  actingUserId: string,
  requestedAuthorId?: string | null,
): Promise<string> {
  if (roleCode === 'DIGITAL_AUTHOR') return actingUserId;

  if (roleCode === 'DIGITAL_MARKETING' || roleCode === 'SUPER_ADMIN') {
    const picked = String(requestedAuthorId || '').trim();
    if (picked && (await isDigitalAuthorId(supabase, picked))) return picked;

    const authors = await fetchDigitalAuthors(supabase);
    if (authors[0]?.id) return authors[0].id;
  }

  return actingUserId;
}
