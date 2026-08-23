import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

export function getDb(): SupabaseClient {
  if (client) return client;
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.MYFNG_SUPABASE_URL ||
    '';
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.MYFNG_SUPABASE_KEY ||
    '';
  if (!url || !key) {
    throw new Error(
      'Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see packages/myfng-mcp/.env.example)',
    );
  }
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { 'X-Client-Info': 'myfng-mcp-readonly/1.0' } },
  });
  return client;
}

export function maxRows(requested?: number | null): number {
  const hard = Math.min(100, Math.max(1, Number(process.env.MYFNG_MCP_MAX_ROWS) || 50));
  if (requested == null || Number.isNaN(Number(requested))) return hard;
  return Math.min(hard, Math.max(1, Math.floor(Number(requested))));
}

export function maskPiiEnabled(): boolean {
  const v = String(process.env.MYFNG_MCP_MASK_PII ?? 'true').toLowerCase();
  return v !== '0' && v !== 'false' && v !== 'no';
}
