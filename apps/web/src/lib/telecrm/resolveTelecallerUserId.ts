import 'server-only';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

const TELECALLER_ROLES = new Set(['TELECALLER', 'LEAD_MANAGER', 'SUB_ADMIN', 'SUPER_ADMIN']);

function normalizePhone10(phone: string): string {
  return String(phone || '').replace(/\D/g, '').slice(-10);
}

function isTelecallerRole(row: { roles?: { role_code?: string } | null } | null): boolean {
  const code = String(row?.roles?.role_code || '').trim().toUpperCase();
  return TELECALLER_ROLES.has(code);
}

export async function resolveTelecallerUserId(input: {
  phone?: string | null;
  email?: string | null;
  name?: string | null;
}): Promise<string | null> {
  const { supabaseAdmin, error } = getSupabaseAdmin();
  if (!supabaseAdmin) {
    console.warn('[telecrm→assignee] admin unavailable:', error);
    return null;
  }

  const phone10 = normalizePhone10(String(input.phone || ''));
  if (phone10.length === 10) {
    for (const candidate of [phone10, `91${phone10}`]) {
      const { data } = await supabaseAdmin
        .from('users_login')
        .select('id, roles(role_code)')
        .eq('phone', candidate)
        .maybeSingle();
      if (data?.id && isTelecallerRole(data as any)) return String(data.id);
    }
  }

  const email = String(input.email || '').trim().toLowerCase();
  if (email) {
    const { data } = await supabaseAdmin
      .from('users_login')
      .select('id, roles(role_code)')
      .ilike('email', email)
      .maybeSingle();
    if (data?.id && isTelecallerRole(data as any)) return String(data.id);
  }

  const name = String(input.name || '').trim();
  if (name.length >= 2) {
    const { data } = await supabaseAdmin
      .from('users_login')
      .select('id, full_name, roles(role_code)')
      .ilike('full_name', `%${name}%`)
      .limit(5);
    for (const row of data || []) {
      if (row?.id && isTelecallerRole(row as any)) return String(row.id);
    }
  }

  return null;
}
