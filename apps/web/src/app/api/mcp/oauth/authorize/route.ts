import { NextRequest, NextResponse } from 'next/server';
import {
  assertClientRedirect,
  getMcpOAuthActor,
  isMcpOAuthApprover,
  issueAuthorizationCode,
  loginRedirectForAuthorize,
  MCP_OAUTH_SCOPE,
  mcpResourceUrl,
  oauthError,
  redirectHostname,
  resourceMatches,
} from '@/lib/mcp/oauth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function esc(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function htmlPage(title: string, body: string, status = 200): Response {
  return new Response(
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(title)}</title>
  <style>
    body { margin:0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif; background:#f1f5f9; color:#0f172a; }
    .wrap { min-height:100dvh; display:flex; align-items:center; justify-content:center; padding:24px; }
    .card { width:100%; max-width:440px; background:#fff; border:1px solid #e2e8f0; border-radius:20px; padding:24px; box-shadow:0 10px 30px rgba(15,23,42,.06); }
    .kicker { font-size:11px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; color:#004AAD; }
    h1 { margin:8px 0 0; font-size:22px; }
    p { color:#475569; line-height:1.5; }
    .box { background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:12px 14px; font-size:13px; }
    .warn { background:#fff7ed; border-color:#fdba74; color:#9a3412; }
    .row { display:flex; gap:10px; margin-top:18px; }
    button { flex:1; border:0; border-radius:12px; padding:12px 14px; font-weight:700; cursor:pointer; }
    .ok { background:#004AAD; color:#fff; }
    .no { background:#e2e8f0; color:#0f172a; }
  </style>
</head>
<body><div class="wrap"><div class="card">${body}</div></div></body>
</html>`,
    {
      status,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    },
  );
}

function readAuthorizeInput(source: URLSearchParams | FormData) {
  const get = (key: string) => String(source.get(key) || '').trim();
  return {
    responseType: get('response_type'),
    clientId: get('client_id'),
    redirectUri: get('redirect_uri'),
    state: get('state'),
    scope: get('scope') || MCP_OAUTH_SCOPE,
    codeChallenge: get('code_challenge'),
    codeChallengeMethod: get('code_challenge_method'),
    resource: get('resource'),
  };
}

function oauthRedirect(redirectUri: string, params: Record<string, string>, status: 302 | 303 = 302) {
  const url = new URL(redirectUri);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url.toString(), status);
}

async function validateAuthorize(input: ReturnType<typeof readAuthorizeInput>) {
  if (input.responseType !== 'code') {
    throw Object.assign(new Error('response_type must be code'), { oauth: 'unsupported_response_type' });
  }
  if (!input.clientId || !input.redirectUri) {
    throw Object.assign(new Error('client_id and redirect_uri are required'), { oauth: 'invalid_request' });
  }
  if (input.codeChallengeMethod && input.codeChallengeMethod !== 'S256') {
    throw Object.assign(new Error('code_challenge_method must be S256'), { oauth: 'invalid_request' });
  }
  if (!input.codeChallenge) {
    throw Object.assign(new Error('PKCE code_challenge is required'), { oauth: 'invalid_request' });
  }
  if (!resourceMatches(input.resource)) {
    throw Object.assign(new Error(`resource must be ${mcpResourceUrl()}`), { oauth: 'invalid_request' });
  }
  await assertClientRedirect(input.clientId, input.redirectUri);
}

export async function GET(request: NextRequest) {
  const input = readAuthorizeInput(request.nextUrl.searchParams);
  try {
    await validateAuthorize(input);
  } catch (e: any) {
    if (input.redirectUri) {
      try {
        return oauthRedirect(input.redirectUri, {
          error: e?.oauth || 'invalid_request',
          error_description: e?.message || 'Invalid authorize request',
          state: input.state,
        });
      } catch {
        /* fall through */
      }
    }
    return htmlPage('MCP OAuth error', `<h1>Cannot continue</h1><p>${esc(e?.message || 'Invalid request')}</p>`, 400);
  }

  const actor = await getMcpOAuthActor(request);
  if (!actor) {
    return NextResponse.redirect(loginRedirectForAuthorize(request.url), 302);
  }
  if (!isMcpOAuthApprover(actor)) {
    return htmlPage(
      'Super Admin only',
      `<p class="kicker">MyFNG MCP</p><h1>Super Admin login required</h1><p>${esc(actor.email)} cannot approve Claude access. Sign in as Super Admin, then try Connect again.</p>`,
      403,
    );
  }

  const host = redirectHostname(input.redirectUri);
  const loopback = host === 'localhost' || host === '127.0.0.1';
  const qs = request.nextUrl.search;

  return htmlPage(
    'Approve MyFNG MCP',
    `<p class="kicker">MyFNG MCP</p>
     <h1>Allow Claude read-only access?</h1>
     <p>Claude can search leads, calls, bookings, and reports. No write tools.</p>
     <div class="box">
       Signed in as <strong>${esc(actor.email)}</strong><br />
       Redirecting back to <strong>${esc(host)}</strong>
     </div>
     ${loopback ? '<p class="box warn">This redirect is a local callback (Claude Code / Desktop).</p>' : ''}
     <form method="post" action="/api/mcp/oauth/authorize${esc(qs)}">
       <div class="row">
         <button class="no" name="decision" value="deny" type="submit">Deny</button>
         <button class="ok" name="decision" value="approve" type="submit">Approve</button>
       </div>
     </form>`,
  );
}

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const query = request.nextUrl.searchParams;
  const merged = new URLSearchParams(query);
  for (const [key, value] of form.entries()) {
    if (!merged.has(key)) merged.set(key, String(value));
  }
  const input = readAuthorizeInput(merged);
  const decision = String(form.get('decision') || merged.get('decision') || '').trim();

  try {
    await validateAuthorize(input);
  } catch (e: any) {
    return oauthError(e?.oauth || 'invalid_request', e?.message || 'Invalid authorize request');
  }

  if (decision === 'deny') {
    return oauthRedirect(
      input.redirectUri,
      { error: 'access_denied', error_description: 'The Super Admin denied access', state: input.state },
      303,
    );
  }

  const actor = await getMcpOAuthActor(request);
  if (!actor) {
    return NextResponse.redirect(loginRedirectForAuthorize(request.url), 303);
  }
  if (!isMcpOAuthApprover(actor)) {
    return htmlPage('Super Admin only', `<h1>Super Admin login required</h1><p>Claude MCP approval is limited to Super Admin.</p>`, 403);
  }

  try {
    const code = await issueAuthorizationCode({
      userId: actor.userId,
      clientId: input.clientId,
      redirectUri: input.redirectUri,
      codeChallenge: input.codeChallenge,
      scope: MCP_OAUTH_SCOPE,
    });
    return oauthRedirect(input.redirectUri, { code, state: input.state }, 303);
  } catch (e: any) {
    return htmlPage('MCP OAuth error', `<h1>Could not issue code</h1><p>${esc(e?.message || 'Server error')}</p>`, 500);
  }
}
