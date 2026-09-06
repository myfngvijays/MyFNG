import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { NextRequest } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import {
  getMcpHttpToken,
  MCP_PUBLIC_ORIGIN,
  mcpCorsHeaders,
  withCors,
} from '@/lib/mcp/httpAuth';

export const MCP_OAUTH_SCOPE = 'mcp:tools';
export const MCP_OAUTH_DCR_SETTING_KEY = 'mcp_oauth_dcr_clients';
export const MCP_OAUTH_SECRET_SETTING_KEY = 'mcp_oauth_signing_secret';

const CODE_TTL_SEC = 10 * 60;
const ACCESS_TTL_SEC = 60 * 60;
const REFRESH_TTL_SEC = 30 * 24 * 60 * 60;
const KNOWN_CLAUDE_REDIRECTS = new Set([
  'https://claude.ai/api/mcp/auth_callback',
  'https://claude.com/api/mcp/auth_callback',
]);

export function mcpResourceUrl(): string {
  return `${MCP_PUBLIC_ORIGIN}/api/mcp`;
}

export function mcpIssuer(): string {
  return MCP_PUBLIC_ORIGIN;
}

export function mcpAuthorizeUrl(): string {
  return `${MCP_PUBLIC_ORIGIN}/api/mcp/oauth/authorize`;
}

export function mcpTokenUrl(): string {
  return `${MCP_PUBLIC_ORIGIN}/api/mcp/oauth/token`;
}

export function mcpRegisterUrl(): string {
  return `${MCP_PUBLIC_ORIGIN}/api/mcp/oauth/register`;
}

export function mcpResourceMetadataUrl(): string {
  return `${MCP_PUBLIC_ORIGIN}/.well-known/oauth-protected-resource/api/mcp`;
}

export function mcpWwwAuthenticate(): string {
  return `Bearer realm="MyFNG MCP", resource_metadata="${mcpResourceMetadataUrl()}", scope="${MCP_OAUTH_SCOPE}"`;
}

export function mcpUnauthorizedResponse(): Response {
  return withCors(
    new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        'WWW-Authenticate': mcpWwwAuthenticate(),
      },
    }),
  );
}

export function oauthCorsHeaders(): Record<string, string> {
  return {
    ...mcpCorsHeaders(),
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers':
      'Authorization, Content-Type, Accept, MCP-Session-Id, MCP-Protocol-Version',
    'Cache-Control': 'no-store',
  };
}

export function oauthJson(data: unknown, status = 200, extra?: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...oauthCorsHeaders(),
      ...extra,
    },
  });
}

export function oauthError(error: string, description: string, status = 400): Response {
  return oauthJson({ error, error_description: description }, status);
}

export function protectedResourceMetadata() {
  return {
    resource: mcpResourceUrl(),
    authorization_servers: [mcpIssuer()],
    bearer_methods_supported: ['header'],
    scopes_supported: [MCP_OAUTH_SCOPE],
  };
}

export function authorizationServerMetadata() {
  return {
    issuer: mcpIssuer(),
    authorization_endpoint: mcpAuthorizeUrl(),
    token_endpoint: mcpTokenUrl(),
    registration_endpoint: mcpRegisterUrl(),
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    client_id_metadata_document_supported: true,
    scopes_supported: [MCP_OAUTH_SCOPE, 'offline_access'],
  };
}

function b64url(input: Buffer | string): string {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf.toString('base64url');
}

function parseB64urlJson(value: string): any | null {
  try {
    return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

async function persistSetting(key: string, value: string, description: string): Promise<void> {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) throw new Error('Admin client unavailable');
  const { error } = await supabaseAdmin.from('system_settings').upsert(
    {
      setting_key: key,
      setting_value: value,
      setting_type: 'STRING',
      category: 'INTEGRATIONS',
      description,
      is_editable: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'setting_key' },
  );
  if (error) throw new Error(error.message);
}

async function readSetting(key: string): Promise<string> {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return '';
  const { data } = await supabaseAdmin
    .from('system_settings')
    .select('setting_value')
    .eq('setting_key', key)
    .maybeSingle();
  return String((data as any)?.setting_value || '').trim();
}

export async function getMcpOAuthSigningSecret(): Promise<string> {
  const env = String(process.env.MYFNG_MCP_OAUTH_SECRET || process.env.MYFNG_MCP_TOKEN || '').trim();
  if (env) return env;
  const staticToken = await getMcpHttpToken();
  if (staticToken) return staticToken;
  const saved = await readSetting(MCP_OAUTH_SECRET_SETTING_KEY);
  if (saved) return saved;
  const generated = randomBytes(32).toString('hex');
  try {
    await persistSetting(
      MCP_OAUTH_SECRET_SETTING_KEY,
      generated,
      'HMAC secret for MyFNG MCP OAuth codes and access tokens',
    );
    return generated;
  } catch {
    const fallback = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
    if (fallback) return `mcp-oauth:${fallback}`;
    throw new Error('MCP OAuth signing secret is not available');
  }
}

type SignedKind = 'mcp_code' | 'mcp_at' | 'mcp_rt';

type SignedPayload = {
  typ: SignedKind;
  sub: string;
  client_id: string;
  redirect_uri?: string;
  code_challenge?: string;
  scope: string;
  aud: string;
  iat: number;
  exp: number;
  jti?: string;
};

function signPayload(payload: SignedPayload, secret: string): string {
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac('sha256', secret).update(body).digest();
  return `mcp1.${body}.${b64url(sig)}`;
}

function readSigned(token: string, secret: string, typ: SignedKind): SignedPayload | null {
  const parts = String(token || '').trim().split('.');
  if (parts.length !== 3 || parts[0] !== 'mcp1') return null;
  const expected = createHmac('sha256', secret).update(parts[1]).digest();
  const actual = Buffer.from(parts[2], 'base64url');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  const payload = parseB64urlJson(parts[1]) as SignedPayload | null;
  if (!payload || payload.typ !== typ) return null;
  if (!payload.exp || payload.exp * 1000 < Date.now()) return null;
  if (payload.aud && payload.aud !== mcpResourceUrl()) return null;
  return payload;
}

export async function issueAuthorizationCode(input: {
  userId: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  scope: string;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return signPayload(
    {
      typ: 'mcp_code',
      sub: input.userId,
      client_id: input.clientId,
      redirect_uri: input.redirectUri,
      code_challenge: input.codeChallenge,
      scope: input.scope,
      aud: mcpResourceUrl(),
      iat: now,
      exp: now + CODE_TTL_SEC,
    },
    await getMcpOAuthSigningSecret(),
  );
}

export async function issueTokenPair(input: {
  userId: string;
  clientId: string;
  scope: string;
}): Promise<{ access_token: string; refresh_token: string; expires_in: number; token_type: 'Bearer'; scope: string }> {
  const secret = await getMcpOAuthSigningSecret();
  const now = Math.floor(Date.now() / 1000);
  const access_token = signPayload(
    {
      typ: 'mcp_at',
      sub: input.userId,
      client_id: input.clientId,
      scope: input.scope,
      aud: mcpResourceUrl(),
      iat: now,
      exp: now + ACCESS_TTL_SEC,
    },
    secret,
  );
  const refresh_token = signPayload(
    {
      typ: 'mcp_rt',
      sub: input.userId,
      client_id: input.clientId,
      scope: input.scope,
      aud: mcpResourceUrl(),
      iat: now,
      exp: now + REFRESH_TTL_SEC,
      jti: randomBytes(16).toString('hex'),
    },
    secret,
  );
  return {
    access_token,
    refresh_token,
    expires_in: ACCESS_TTL_SEC,
    token_type: 'Bearer',
    scope: input.scope,
  };
}

function verifyS256(verifier: string, challenge: string): boolean {
  if (!verifier || verifier.length < 43 || verifier.length > 128) return false;
  const computed = b64url(createHash('sha256').update(verifier).digest());
  const a = Buffer.from(computed);
  const b = Buffer.from(challenge);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function exchangeAuthorizationCode(input: {
  code: string;
  clientId: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<{ access_token: string; refresh_token: string; expires_in: number; token_type: 'Bearer'; scope: string }> {
  const payload = readSigned(input.code, await getMcpOAuthSigningSecret(), 'mcp_code');
  if (!payload) throw Object.assign(new Error('Invalid or expired authorization code'), { oauth: 'invalid_grant' });
  if (payload.client_id !== input.clientId) {
    throw Object.assign(new Error('client_id does not match'), { oauth: 'invalid_grant' });
  }
  if (payload.redirect_uri !== input.redirectUri) {
    throw Object.assign(new Error('redirect_uri does not match'), { oauth: 'invalid_grant' });
  }
  if (!payload.code_challenge || !verifyS256(input.codeVerifier, payload.code_challenge)) {
    throw Object.assign(new Error('PKCE verification failed'), { oauth: 'invalid_grant' });
  }
  return issueTokenPair({
    userId: payload.sub,
    clientId: payload.client_id,
    scope: payload.scope || MCP_OAUTH_SCOPE,
  });
}

export async function refreshAccessToken(input: {
  refreshToken: string;
  clientId: string;
}): Promise<{ access_token: string; refresh_token: string; expires_in: number; token_type: 'Bearer'; scope: string }> {
  const payload = readSigned(input.refreshToken, await getMcpOAuthSigningSecret(), 'mcp_rt');
  if (!payload) throw Object.assign(new Error('Invalid or expired refresh token'), { oauth: 'invalid_grant' });
  if (payload.client_id !== input.clientId) {
    throw Object.assign(new Error('client_id does not match'), { oauth: 'invalid_grant' });
  }
  return issueTokenPair({
    userId: payload.sub,
    clientId: payload.client_id,
    scope: payload.scope || MCP_OAUTH_SCOPE,
  });
}

export async function isValidMcpAccessToken(token: string): Promise<boolean> {
  try {
    return Boolean(readSigned(token, await getMcpOAuthSigningSecret(), 'mcp_at'));
  } catch {
    return false;
  }
}

export function canonicalResource(value: string | null | undefined): string {
  return String(value || '').trim().replace(/\/$/, '');
}

export function resourceMatches(value: string | null | undefined): boolean {
  if (!value) return true;
  return canonicalResource(value) === canonicalResource(mcpResourceUrl());
}

function loopbackTarget(uri: string): { host: string; path: string } | null {
  try {
    const parsed = new URL(uri);
    if (parsed.protocol !== 'http:') return null;
    if (parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') return null;
    return { host: parsed.hostname, path: parsed.pathname };
  } catch {
    return null;
  }
}

export function redirectUrisMatch(requested: string, registered: string[]): boolean {
  if (registered.includes(requested)) return true;
  const reqLoop = loopbackTarget(requested);
  if (!reqLoop) return false;
  return registered.some((entry) => {
    const reg = loopbackTarget(entry);
    if (!reg) return false;
    if (reg.path !== reqLoop.path) return false;
    return reg.host === reqLoop.host || (reg.host === 'localhost' && reqLoop.host === '127.0.0.1') || (reg.host === '127.0.0.1' && reqLoop.host === 'localhost');
  });
}

export function isKnownClaudeRedirect(uri: string): boolean {
  if (KNOWN_CLAUDE_REDIRECTS.has(uri)) return true;
  const loop = loopbackTarget(uri);
  return Boolean(loop && loop.path === '/callback');
}

async function loadDcrClients(): Promise<Record<string, { redirect_uris: string[] }>> {
  const raw = await readSetting(MCP_OAUTH_DCR_SETTING_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export async function registerDcrClient(redirectUris: string[]): Promise<{ client_id: string; redirect_uris: string[] }> {
  const clientId = `mcp_${randomBytes(16).toString('hex')}`;
  const clients = await loadDcrClients();
  clients[clientId] = { redirect_uris: redirectUris };
  await persistSetting(
    MCP_OAUTH_DCR_SETTING_KEY,
    JSON.stringify(clients),
    'Dynamic client registrations for MyFNG MCP OAuth',
  );
  return { client_id: clientId, redirect_uris: redirectUris };
}

async function fetchCimd(clientId: string): Promise<{ redirect_uris: string[] } | null> {
  if (!/^https:\/\//i.test(clientId)) return null;
  const ctrl = AbortSignal.timeout(8000);
  const res = await fetch(clientId, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal: ctrl,
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const json = (await res.json().catch(() => null)) as any;
  if (!json || typeof json !== 'object') return null;
  if (json.client_id && String(json.client_id) !== clientId) return null;
  const uris = Array.isArray(json.redirect_uris) ? json.redirect_uris.map(String) : [];
  return { redirect_uris: uris };
}

export async function assertClientRedirect(clientId: string, redirectUri: string): Promise<void> {
  if (!clientId || !redirectUri) {
    throw Object.assign(new Error('client_id and redirect_uri are required'), { oauth: 'invalid_request' });
  }

  const dcr = await loadDcrClients();
  if (dcr[clientId] && redirectUrisMatch(redirectUri, dcr[clientId].redirect_uris || [])) return;

  if (/^https:\/\//i.test(clientId)) {
    try {
      const cimd = await fetchCimd(clientId);
      if (cimd && redirectUrisMatch(redirectUri, cimd.redirect_uris)) return;
    } catch {
      /* fall through to known Claude redirects */
    }
    if (/claude\.ai|claude\.com|anthropic\.com/i.test(clientId) && isKnownClaudeRedirect(redirectUri)) {
      return;
    }
  }

  if (isKnownClaudeRedirect(redirectUri)) return;

  throw Object.assign(new Error('redirect_uri is not registered for this client'), { oauth: 'invalid_request' });
}

export type McpOAuthActor = {
  userId: string;
  email: string;
  role: string;
};

export async function getMcpOAuthActor(request: NextRequest): Promise<McpOAuthActor | null> {
  const supabase = await createClientFromRequest(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from('users_login')
    .select('id, role:roles!role_id(role_code)')
    .eq('id', user.id)
    .maybeSingle();
  const role = String((profile as any)?.role?.role_code || '');
  return {
    userId: String((profile as any)?.id || user.id),
    email: String(user.email || ''),
    role,
  };
}

export function isMcpOAuthApprover(actor: McpOAuthActor | null): actor is McpOAuthActor {
  return Boolean(actor && actor.role === 'SUPER_ADMIN');
}

export function loginRedirectForAuthorize(requestUrl: string): string {
  const next = `/api/mcp/oauth/authorize?${new URL(requestUrl).searchParams.toString()}`;
  return `${MCP_PUBLIC_ORIGIN}/login?next=${encodeURIComponent(next)}`;
}

export function safeAuthorizeNext(raw: string | null | undefined): string | null {
  const value = String(raw || '');
  if (!value.startsWith('/api/mcp/oauth/authorize')) return null;
  if (value.startsWith('//') || value.includes('://')) return null;
  return value;
}

export function redirectHostname(uri: string): string {
  try {
    return new URL(uri).hostname || uri;
  } catch {
    return uri;
  }
}
