import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

export function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_ADMIN_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return { supabaseAdmin: null as any, error: 'Missing SUPABASE_SERVICE_ROLE_KEY / SUPABASE_URL' as const };
  }

  const supabaseAdmin = createSupabaseAdminClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return { supabaseAdmin, error: null as any };
}


