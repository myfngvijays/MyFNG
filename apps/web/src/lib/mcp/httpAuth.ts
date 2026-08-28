import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export const MCP_TOKEN_SETTING_KEY = 'mcp_http_token';
export const MCP_PUBLIC_ORIGIN = (process.env.NEXT_PUBLIC_SITE_URL || 'https://myfng.in').replace(/\/$/, '');
export const CLAUDE_CONNECTORS_URL = 'https://claude.ai/settings/connectors';

function maskToken(token: string): string {
  const t = token.trim();
  if (!t) return '';
  if (t.length <= 6) return '••••';
  return `••••${t.slice(-4)}`;
}

export async function getMcpHttpToken(): Promise<string> {
  const fromEnv = String(process.env.MYFNG_MCP_TOKEN || '').trim();
  if (fromEnv) return fromEnv;
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return '';
  const { data } = await supabaseAdmin
    .from('system_settings')
    .select('setting_value')
    .eq('setting_key', MCP_TOKEN_SETTING_KEY)
    .maybeSingle();
  return String((data as any)?.setting_value || '').trim();
}

export async function saveMcpHttpToken(token: string, userId?: string | null): Promise<void> {
  const { supabaseAdmin, error } = getSupabaseAdmin();
  if (!supabaseAdmin) throw new Error(error || 'Admin client unavailable');
  const row = {
    setting_key: MCP_TOKEN_SETTING_KEY,
    setting_value: token.trim(),
    setting_type: 'STRING',
    category: 'INTEGRATIONS',
    description: 'Bearer token for Claude remote MCP (POST https://…/api/mcp)',
    is_editable: true,
    updated_by: userId || null,
    updated_at: new Date().toISOString(),
  };
  const { error: upErr } = await supabaseAdmin.from('system_settings').upsert(row, {
    onConflict: 'setting_key',
  });
  if (upErr) throw new Error(upErr.message);
}

export async function mcpTokenStatus() {
  const token = await getMcpHttpToken();
  return {
    has_token: Boolean(token),
    from_env: Boolean(String(process.env.MYFNG_MCP_TOKEN || '').trim()),
    hint: maskToken(token),
  };
}

export function extractMcpTokenFromRequest(req: Request): string {
  const auth = req.headers.get('authorization') || req.headers.get('Authorization') || '';
  const bearer = auth.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || '';
  if (bearer) return bearer;
  const apiKey = (req.headers.get('x-api-key') || '').trim();
  if (apiKey) return apiKey;
  try {
    const url = new URL(req.url);
    return (url.searchParams.get('token') || url.searchParams.get('key') || '').trim();
  } catch {
    return '';
  }
}

export function mcpCorsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers':
      'Authorization, Content-Type, Accept, MCP-Session-Id, MCP-Protocol-Version, Last-Event-ID, x-api-key',
    'Access-Control-Expose-Headers': 'MCP-Session-Id, MCP-Protocol-Version',
  };
}

export function withCors(res: Response): Response {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(mcpCorsHeaders())) headers.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}
