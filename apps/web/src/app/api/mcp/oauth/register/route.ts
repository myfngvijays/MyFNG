import { oauthCorsHeaders, oauthError, oauthJson, registerDcrClient } from '@/lib/mcp/oauth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isAllowedRedirect(uri: string): boolean {
  try {
    const parsed = new URL(uri);
    if (parsed.protocol === 'https:') return true;
    if (parsed.protocol === 'http:' && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const redirectUris = Array.isArray(body?.redirect_uris) ? body.redirect_uris.map(String) : [];
  if (!redirectUris.length || !redirectUris.every(isAllowedRedirect)) {
    return oauthError('invalid_client_metadata', 'redirect_uris must be https or loopback http URLs', 400);
  }

  try {
    const registered = await registerDcrClient(redirectUris);
    return oauthJson(
      {
        client_id: registered.client_id,
        redirect_uris: registered.redirect_uris,
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: 'none',
        client_id_issued_at: Math.floor(Date.now() / 1000),
      },
      201,
    );
  } catch (e: any) {
    return oauthError('server_error', e?.message || 'Registration failed', 500);
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: oauthCorsHeaders() });
}
