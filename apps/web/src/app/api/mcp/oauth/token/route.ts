import {
  exchangeAuthorizationCode,
  oauthCorsHeaders,
  oauthError,
  oauthJson,
  refreshAccessToken,
} from '@/lib/mcp/oauth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function readTokenParams(req: Request): Promise<URLSearchParams> {
  const contentType = req.headers.get('content-type') || '';
  if (contentType.includes('application/x-www-form-urlencoded')) {
    return new URLSearchParams(await req.text());
  }
  if (contentType.includes('application/json')) {
    const json = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(json || {})) {
      if (value != null) params.set(key, String(value));
    }
    return params;
  }
  return new URLSearchParams(await req.text().catch(() => ''));
}

export async function POST(req: Request) {
  const params = await readTokenParams(req);
  const grantType = String(params.get('grant_type') || '').trim();
  const clientId = String(params.get('client_id') || '').trim();

  if (!clientId) return oauthError('invalid_request', 'client_id is required');

  try {
    if (grantType === 'authorization_code') {
      const tokens = await exchangeAuthorizationCode({
        code: String(params.get('code') || ''),
        clientId,
        redirectUri: String(params.get('redirect_uri') || ''),
        codeVerifier: String(params.get('code_verifier') || ''),
      });
      return oauthJson(tokens);
    }

    if (grantType === 'refresh_token') {
      const tokens = await refreshAccessToken({
        refreshToken: String(params.get('refresh_token') || ''),
        clientId,
      });
      return oauthJson(tokens);
    }

    return oauthError('unsupported_grant_type', 'Use authorization_code or refresh_token');
  } catch (e: any) {
    const code = e?.oauth === 'invalid_grant' ? 'invalid_grant' : 'invalid_request';
    return oauthError(code, e?.message || 'Token request failed', code === 'invalid_grant' ? 400 : 400);
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: oauthCorsHeaders() });
}
